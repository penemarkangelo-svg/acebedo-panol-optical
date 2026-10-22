import { useEffect, useRef, useState } from "react";
import VisionTestLayout from "./VisionTestUI/VisionTestLayout";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { ACUITY, CAMERA, MEDIAPIPE, POSITION_MONITOR, SESSION_KEYS } from "../constants/screeningConfig";
import { clamp, getLandoltGeometry, getMinDisplayLogMAR, round } from "../utils/acuityMath";
import { estimateLogMAR, nextLogMAR } from "../utils/staircase";
import { getMovementMessage, getRelativeFaceMetrics, smoothMetrics } from "../utils/facePosition";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  EyeIcon,
  InfoCircleIcon,
  PauseCircleIcon,
} from "@solar-icons/react/linear";

/* Values come from constants/screeningConfig.js. Edit them there. */
const { wasmUrl: MEDIAPIPE_WASM_URL, modelUrl: FACE_MODEL_URL } = MEDIAPIPE;
const CALIBRATION_KEY = SESSION_KEYS.calibration;
const {
  eyeOrder: EYE_ORDER,
  trialsPerEye: TRIALS_PER_EYE,
  testDistanceMm: TEST_DISTANCE_MM,
  startLogMAR: START_LOGMAR,
  minLogMAR: MIN_LOGMAR,
  maxDiameterPx: MAX_DIAMETER_PX,
} = ACUITY;
const {
  checkIntervalMs: FACE_CHECK_INTERVAL,
  eyeCoveredThreshold: EYE_COVERED_THRESHOLD,
  warningConfirmMs: MOVEMENT_WARNING_CONFIRMATION_MS,
  pauseConfirmMs: MOVEMENT_PAUSE_CONFIRMATION_MS,
  faceLostMs: FACE_LOST_CONFIRMATION_MS,
  multipleFaceMs: MULTIPLE_FACE_CONFIRMATION_MS,
} = POSITION_MONITOR;
const { scale: WARNING_SCALE_TOLERANCE, x: WARNING_POSITION_TOLERANCE_X, y: WARNING_POSITION_TOLERANCE_Y } = POSITION_MONITOR.warning;
const { scale: PAUSE_SCALE_TOLERANCE, x: PAUSE_POSITION_TOLERANCE_X, y: PAUSE_POSITION_TOLERANCE_Y } = POSITION_MONITOR.pause;
const { scale: RESUME_SCALE_TOLERANCE, x: RESUME_POSITION_TOLERANCE_X, y: RESUME_POSITION_TOLERANCE_Y } = POSITION_MONITOR.resume;

/* UI-only constants */
const ORIENTATIONS = [
  { id: "up", angle: 0 },
  { id: "right", angle: 90 },
  { id: "down", angle: 180 },
  { id: "left", angle: 270 },
];

/* Reference UI order: Up, Down, Left, Right */
const ANSWERS = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

const ARROW_ICONS = {
  up: ArrowUpIcon,
  right: ArrowRightIcon,
  down: ArrowDownIcon,
  left: ArrowLeftIcon,
};

function readSessionJson(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/*
 * ISO 8596 Landolt C on a 5x5 grid: outer diameter 5, stroke 1, gap 1,
 * flat-cut gap, no rounded caps. angle 0 = gap at the top, rotating clockwise.
 */
const LANDOLT_PATH = "M3 0.0505 A2.5 2.5 0 1 1 2 0.0505 L2 1.0858 A1.5 1.5 0 1 0 3 1.0858 Z";

function LandoltC({ sizePx, angle }) {
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 5 5"
      role="img"
      aria-label="Landolt C"
      shapeRendering="geometricPrecision"
      style={{ display: "block", transform: `rotate(${angle}deg)` }}
    >
      <path d={LANDOLT_PATH} fill="#000" />
    </svg>
  );
}

/* ---------- Component ---------- */
export default function VisualAcuity({ onContinue, onComplete }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const faceAnimationRef = useRef(null);
  const lastFaceDetectionRef = useRef(0);
  const movementWarningStartedRef = useRef(null);
  const movementPauseStartedRef = useRef(null);
  const faceLostStartedRef = useRef(null);
  const multipleFaceStartedRef = useRef(null);
  const smoothedMetricsRef = useRef(null);
  const pausedForPositionRef = useRef(false);
  const mountedRef = useRef(true);
  const localBaselineRef = useRef(null);
  const savedBaselineRef = useRef(null); // face position saved by Environment Setup
  const trialHistoryRef = useRef([]);
  const eyeCoverWarningRef = useRef("");

  const [calibration, setCalibration] = useState(null);
  const [localBaseline, setLocalBaseline] = useState(null);
  const [setupError, setSetupError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [faceTrackingReady, setFaceTrackingReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState("starting");
  const [positionWarning, setPositionWarning] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [pausedForPosition, setPausedForPosition] = useState(false);
  const [eyeCoverWarning, setEyeCoverWarning] = useState("");

  const [eyeIndex, setEyeIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [logMAR, setLogMAR] = useState(START_LOGMAR);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [currentOrientation, setCurrentOrientation] = useState(null);
  const [currentGeometry, setCurrentGeometry] = useState(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [eyeResults, setEyeResults] = useState([]);

  const currentEye = EYE_ORDER[eyeIndex];
  const currentEyeRef = useRef(currentEye);
  useEffect(() => { currentEyeRef.current = currentEye; }, [currentEye]);
  useEffect(() => { pausedForPositionRef.current = pausedForPosition; }, [pausedForPosition]);

  const minLogMAR = calibration?.pixelsPerMm ? getMinDisplayLogMAR(calibration.pixelsPerMm) : MIN_LOGMAR;
  const effectiveLogMAR = Math.max(logMAR, minLogMAR);

  /* Load calibration + cleanup */
  useEffect(() => {
    mountedRef.current = true;
    const saved = readSessionJson(CALIBRATION_KEY);
    setCalibration(saved);

    // Reference viewing position established in Environment Setup (no second baseline here)
    const vp = readSessionJson(SESSION_KEYS.viewingPosition);
    const m = vp?.measurement;
    if (m && vp.frame?.width && vp.frame?.height) {
      savedBaselineRef.current = {
        metrics: {
          eyeDistance: m.baselineEyeDistance,
          faceWidth: m.baselineFaceWidth,
          faceHeight: m.baselineFaceHeight,
          centerX: m.baselineCenterX,
          centerY: m.baselineCenterY,
        },
        aspect: vp.frame.width / vp.frame.height,
      };
    }

    if (!saved?.pixelsPerMm) setSetupError("Screen calibration was not found. Please complete Environment Setup first.");
    else if (!savedBaselineRef.current) setSetupError("Your viewing position was not found. Please complete Environment Setup first.");

    return () => {
      mountedRef.current = false;
      if (faceAnimationRef.current) cancelAnimationFrame(faceAnimationRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (faceLandmarkerRef.current) {
        try { faceLandmarkerRef.current.close(); } catch { /* ignore */ }
      }
    };
  }, []);

  function createTrial(level) {
    if (!calibration?.pixelsPerMm) return;
    setCurrentOrientation(ORIENTATIONS[Math.floor(Math.random() * ORIENTATIONS.length)]);
    setCurrentGeometry(getLandoltGeometry(level, calibration.pixelsPerMm));
    setAnswerLocked(false);
    setFeedback("");
  }

  useEffect(() => {
    if (!calibration?.pixelsPerMm || !localBaseline) return;
    createTrial(effectiveLogMAR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyeIndex, trialIndex, calibration, localBaseline]);

  /* Camera + MediaPipe */
  async function startCameraAndTracking() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: CAMERA.width }, height: { ideal: CAMERA.height } },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);

      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 2,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
      if (!mountedRef.current) {
        landmarker.close();
        return;
      }
      faceLandmarkerRef.current = landmarker;
      setFaceTrackingReady(true);
    } catch (error) {
      console.error("Visual acuity camera/tracking error:", error);
      setFaceStatus("error");
      setSetupError("Camera or face tracking could not start. Please allow camera access and try again.");
    }
  }

  useEffect(() => {
    if (!calibration?.pixelsPerMm) return;
    startCameraAndTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibration]);

  /* Face tracking loop: baseline, drift, pause, eye cover */
  useEffect(() => {
    if (!faceTrackingReady || !faceLandmarkerRef.current) return;
    let stopped = false;

    const clearMovementTimers = () => {
      movementWarningStartedRef.current = null;
      movementPauseStartedRef.current = null;
      faceLostStartedRef.current = null;
      multipleFaceStartedRef.current = null;
    };

    const isPositionRestored = (m, b) =>
      Math.abs(m.eyeDistance / b.eyeDistance - 1) <= RESUME_SCALE_TOLERANCE &&
      Math.abs(m.centerX - b.centerX) <= RESUME_POSITION_TOLERANCE_X &&
      Math.abs(m.centerY - b.centerY) <= RESUME_POSITION_TOLERANCE_Y;

    function pauseFor(reason) {
      pausedForPositionRef.current = true;
      setPausedForPosition(true);
      setPositionWarning("");
      setMovementReason(reason);
    }

    function detectFaceFrame(now) {
      if (stopped) return;
      faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
      if (now - lastFaceDetectionRef.current < FACE_CHECK_INTERVAL) return;
      lastFaceDetectionRef.current = now;

      const video = videoRef.current;
      const landmarker = faceLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2 || video.videoWidth <= 0) return;

      try {
        const result = landmarker.detectForVideo(video, now);
        const faces = result?.faceLandmarks || [];

        if (faces.length === 0) {
          setFaceStatus("not-detected");
          multipleFaceStartedRef.current = null;
          if (!faceLostStartedRef.current) faceLostStartedRef.current = now;
          if (now - faceLostStartedRef.current >= FACE_LOST_CONFIRMATION_MS && !pausedForPositionRef.current && localBaselineRef.current) {
            pauseFor("We can't see your face clearly. Please face the camera and return to your viewing distance. Make sure your hand isn't covering your whole face.");
          }
          return;
        }

        if (faces.length > 1) {
          setFaceStatus("multiple");
          faceLostStartedRef.current = null;
          if (!multipleFaceStartedRef.current) multipleFaceStartedRef.current = now;
          if (now - multipleFaceStartedRef.current >= MULTIPLE_FACE_CONFIRMATION_MS && !pausedForPositionRef.current && localBaselineRef.current) {
            pauseFor("Only one face should be visible during the screening.");
          }
          return;
        }

        faceLostStartedRef.current = null;
        multipleFaceStartedRef.current = null;

        const metrics = getRelativeFaceMetrics(faces[0]);
        if (!metrics) return;
        const smoothed = smoothMetrics(smoothedMetricsRef.current, metrics);
        smoothedMetricsRef.current = smoothed;

        /* Eye cover verification (smoothed blink blendshapes) */
        let coverWarning = "";
        const blendshapes = result.faceBlendshapes?.[0]?.categories;
        if (blendshapes && localBaselineRef.current) {
          const rawLeft = blendshapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score || 0;
          const rawRight = blendshapes.find((c) => c.categoryName === "eyeBlinkRight")?.score || 0;
          if (!smoothed.blink) smoothed.blink = { left: rawLeft, right: rawRight };
          smoothed.blink.left = smoothed.blink.left * 0.85 + rawLeft * 0.15;
          smoothed.blink.right = smoothed.blink.right * 0.85 + rawRight * 0.15;
          const left = smoothed.blink.left;
          const right = smoothed.blink.right;

          if (currentEyeRef.current === "right") {
            if (left < EYE_COVERED_THRESHOLD) coverWarning = "Please close your left eye to continue.";
            else if (right > EYE_COVERED_THRESHOLD) coverWarning = "Please keep your testing eye (right) open.";
          } else if (currentEyeRef.current === "left") {
            if (right < EYE_COVERED_THRESHOLD) coverWarning = "Please close your right eye to continue.";
            else if (left > EYE_COVERED_THRESHOLD) coverWarning = "Please keep your testing eye (left) open.";
          }
        }
        if (coverWarning !== eyeCoverWarningRef.current) {
          eyeCoverWarningRef.current = coverWarning;
          setEyeCoverWarning(coverWarning);
        }

        /* Use the position saved in Setup as the reference */
        if (!localBaselineRef.current) {
          const saved = savedBaselineRef.current;
          if (Math.abs(video.videoWidth / video.videoHeight - saved.aspect) > 0.05) {
            stopped = true;
            setSetupError("The camera settings changed since setup. Please complete Environment Setup again.");
            return;
          }
          localBaselineRef.current = saved.metrics;
          setLocalBaseline(saved.metrics);
          if (isPositionRestored(smoothed, saved.metrics)) {
            setFaceStatus("position-ok");
          } else {
            setFaceStatus("reposition");
            pauseFor("Please sit back in the position you set during setup.");
          }
          return;
        }

        const baseline = localBaselineRef.current;
        const scaleRatio = smoothed.eyeDistance / baseline.eyeDistance;
        const scaleDev = Math.abs(scaleRatio - 1);
        const xDev = Math.abs(smoothed.centerX - baseline.centerX);
        const yDev = Math.abs(smoothed.centerY - baseline.centerY);

        const warningExceeded =
          scaleDev > WARNING_SCALE_TOLERANCE || xDev > WARNING_POSITION_TOLERANCE_X || yDev > WARNING_POSITION_TOLERANCE_Y;
        const pauseExceeded =
          scaleDev > PAUSE_SCALE_TOLERANCE || xDev > PAUSE_POSITION_TOLERANCE_X || yDev > PAUSE_POSITION_TOLERANCE_Y;

        if (pausedForPositionRef.current && isPositionRestored(smoothed, baseline)) {
          clearMovementTimers();
          pausedForPositionRef.current = false;
          setPausedForPosition(false);
          setMovementReason("");
          setPositionWarning("");
          setFaceStatus("position-ok");
          setFeedback("Position restored.");
          return;
        }

        if (!warningExceeded) {
          clearMovementTimers();
          setFaceStatus(pausedForPositionRef.current ? "reposition" : "position-ok");
          if (!pausedForPositionRef.current) setPositionWarning("");
          return;
        }

        setFaceStatus("reposition");
        if (!movementWarningStartedRef.current) movementWarningStartedRef.current = now;
        if (now - movementWarningStartedRef.current >= MOVEMENT_WARNING_CONFIRMATION_MS) {
          setPositionWarning(pauseExceeded ? "Please return to your viewing distance." : "Stay roughly at your viewing distance.");
        }

        if (pauseExceeded) {
          if (!movementPauseStartedRef.current) movementPauseStartedRef.current = now;
          if (now - movementPauseStartedRef.current >= MOVEMENT_PAUSE_CONFIRMATION_MS && !pausedForPositionRef.current) {
            pauseFor(
              getMovementMessage({
                scaleExceeded: scaleDev > PAUSE_SCALE_TOLERANCE,
                xExceeded: xDev > PAUSE_POSITION_TOLERANCE_X,
                yExceeded: yDev > PAUSE_POSITION_TOLERANCE_Y,
                scaleRatio,
              })
            );
          }
        } else {
          movementPauseStartedRef.current = null;
        }
      } catch (error) {
        console.error("Visual acuity face detection error:", error);
      }
    }

    faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
    return () => {
      stopped = true;
      if (faceAnimationRef.current) cancelAnimationFrame(faceAnimationRef.current);
    };
  }, [faceTrackingReady]);

  /* Complete visual acuity and continue directly to Duochrome. */
  function finishScreening(nextEyeResults) {
    const result = {
      completedAt: new Date().toISOString(),
      method: "digital-landolt-c-preliminary-screening",
      validationStatus: "engineering-prototype-not-clinically-validated",
      calibration: {
        pixelsPerMm: calibration?.pixelsPerMm ?? null,
        cardWidthMm: calibration?.cardWidthMm ?? 85.6,
      },
      testDistanceMm: TEST_DISTANCE_MM,
      smallestDisplayableLogMAR: minLogMAR,
      viewingPosition: {
        monitoring: "relative-face-position",
        validationStatus: "engineering-prototype-not-clinically-validated",
      },
      eyes: nextEyeResults,
    };
    try { sessionStorage.setItem(SESSION_KEYS.acuity, JSON.stringify(result)); } catch { /* ignore */ }

    // Save the acuity result, then move directly to the Duochrome test.
    // The acuity screen intentionally does not display a results page.
    if (onComplete) onComplete(result);
    if (onContinue) onContinue(result);
  }

  function finishEye() {
    // Read from the ref so the final trial is included (state would be stale inside setTimeout).
    const trials = trialHistoryRef.current.filter((t) => t.eye === currentEye);
    const estimated = estimateLogMAR(trials, effectiveLogMAR);

    const eyeResult = {
      eye: currentEye,
      trials,
      estimatedLogMAR: round(estimated, 2),
      limitedByScreen: estimated <= minLogMAR + 0.05,
      correctResponses: trials.filter((t) => t.correct).length,
      totalResponses: trials.length,
    };
    const nextEyeResults = [...eyeResults, eyeResult];
    setEyeResults(nextEyeResults);

    if (eyeIndex >= EYE_ORDER.length - 1) {
      finishScreening(nextEyeResults);
      return;
    }
    setEyeIndex((v) => v + 1);
    setTrialIndex(0);
    setLogMAR(START_LOGMAR);
    setCorrectStreak(0);
    pausedForPositionRef.current = false;
    setPausedForPosition(false);
    setPositionWarning("");
    setMovementReason("");
    setFeedback("");
  }

  function handleAnswer(answerId) {
    if (pausedForPosition || eyeCoverWarning || answerLocked || !currentOrientation || !localBaseline) return;

    setAnswerLocked(true);
    const correct = answerId === currentOrientation.id; // "unseen" is always scored incorrect
    trialHistoryRef.current = [
      ...trialHistoryRef.current,
      {
        eye: currentEye,
        trial: trialIndex + 1,
        logMAR: effectiveLogMAR,
        correct,
        expected: currentOrientation.id,
        answered: answerId,
        timestamp: new Date().toISOString(),
      },
    ];
    const streak = correct ? correctStreak + 1 : 0;
    const nextLog = nextLogMAR(effectiveLogMAR, streak, correct, minLogMAR);

    if (trialIndex + 1 >= TRIALS_PER_EYE) {
      setTimeout(() => { if (mountedRef.current) finishEye(); }, 450);
      return;
    }
    setTimeout(() => {
      if (!mountedRef.current) return;
      setCorrectStreak(streak);
      setLogMAR(nextLog);
      setTrialIndex((v) => v + 1);
    }, 450);
  }

  function handleKeyboard(event) {
    if (pausedForPosition || eyeCoverWarning || !localBaseline) return;
    const answer = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" }[event.key];
    if (answer) {
      event.preventDefault();
      handleAnswer(answer);
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  /* ---------- Derived UI state ---------- */
  const shouldLockTest = pausedForPosition || !!eyeCoverWarning;
  const tone = pausedForPosition ? "bad" : positionWarning ? "warn" : "ok";
  /* Target oval: where the face was at baseline (video is mirrored) */
  const b = localBaseline;
  const ovalStyle = b
    ? {
        left: `${(1 - b.centerX) * 100}%`,
        top: `${b.centerY * 100}%`,
        width: `${b.faceWidth * 100}%`,
        height: `${b.faceHeight * 100}%`,
        transform: "translate(-50%, -50%)",
      }
    : {
        left: "50%",
        top: "50%",
        width: "38%",
        height: "72%",
        transform: "translate(-50%, -50%)",
      };
  const ovalColor = pausedForPosition
    ? "var(--acebedo-red)"
    : faceStatus === "position-ok"
      ? "rgba(33,201,151,.95)"
      : "rgba(255,255,255,.85)";

  const positionLabel = pausedForPosition
    ? "Paused"
    : positionWarning
      ? "Adjust position"
      : "Position good";

  const positionToneClass = pausedForPosition
    ? "is-bad"
    : positionWarning
      ? "is-warn"
      : "is-good";

  const page = "acebedo-page acebedo-va-page";

  if (setupError) {
    return (
      <section className={page}>
        <div className="acebedo-container">
          <div className="acebedo-va-message-card">
            <p className="acebedo-eyebrow">Distance vision / visual acuity</p>
            <h1 className="acebedo-heading">Setup is incomplete</h1>
            <p className="acebedo-text acebedo-va-message-copy">{setupError}</p>
            <button
              type="button"
              onClick={() => (onContinue ? onContinue() : window.history.back())}
              className="acebedo-btn acebedo-btn-primary"
            >
              Return to Setup
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={page}>
     <div className="acebedo-container py-8 md:py-12">
        <VisionTestLayout
          eyebrow="Distance vision / visual acuity"
          title="Visual Acuity Test"
          instruction={
            localBaseline
              ? "One eye at a time. Tell us where you see the opening in the ring."
              : "Stay in the viewing position you set during setup."
          }
status={
            localBaseline ? (
              <>
                <div className={`acebedo-va-position-status ${positionToneClass}`}>
                  <span
                    className="acebedo-va-position-dot"
                    aria-hidden="true"
                  />
                  <span className="acebedo-va-position-label">
                    {positionLabel}
                  </span>
                </div>

                <div className="acebedo-va-position-help">
                  Keep your current distance
                </div>
              </>
            ) : (
              <div>
                <strong>Preparing assessment</strong>
                <div>Checking your viewing position.</div>
              </div>
            )
          }
          assessment={
            localBaseline ? (
              <div>
                <p className="vision-test__section-label">Your assessment</p>

                <div className="vision-test__eye-list">
                  {EYE_ORDER.map((eye, index) => {
                    const active = index === eyeIndex;
                    const complete = index < eyeIndex;

                    return (
                      <div
                        key={eye}
                        className={`vision-test__eye-status ${
                          active ? "vision-test__eye-status--active" : ""
                        } ${complete ? "vision-test__eye-status--complete" : ""}`}
                      >
                        <div className="vision-test__eye-status-name">
                          {complete ? (
                            <CheckCircleIcon
                              className="vision-test__eye-complete-icon"
                              size={22}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="vision-test__eye-number"
                              aria-hidden="true"
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          )}
                          <span>{eye === "right" ? "Right Eye" : "Left Eye"}</span>
                        </div>

                        <div className="vision-test__eye-status-state">
                          {active ? "In progress" : complete ? "Complete" : "Up next"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="acebedo-va-cover-note">
                  <EyeIcon size={22} strokeWidth={1.5} aria-hidden="true" />
                  <h2>
                    Cover your {currentEye === "right" ? "left" : "right"} eye.
                  </h2>
                  <p>
                    Keep your {currentEye} eye open. Rest your hand gently over the
                    other eye without pressing.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="vision-test__section-label">Your assessment</p>
                <p className="vision-test__panel-title">Setup check</p>
                <p className="vision-test__panel-copy">
                  The test will begin automatically when your viewing position is ready.
                </p>
              </div>
            )
          }
          testSurface={
            <div className="vision-test__surface-content vision-test__acuity-surface">
              {/* The camera stays mounted throughout the test so MediaPipe can
                  continue monitoring viewing position. Its preview is only shown
                  when the patient needs to reposition or correct eye coverage. */}
              <div
                className="vision-test__camera-monitor"
                aria-hidden={!shouldLockTest}
                style={
                  shouldLockTest
                    ? undefined
                    : {
                        position: "absolute",
                        width: 1,
                        height: 1,
                        overflow: "hidden",
                        opacity: 0,
                        pointerEvents: "none",
                      }
                }
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    display: "block",
                  }}
                />

                {shouldLockTest && (
                  <>
                    <div
                      className="acebedo-va-camera-oval"
                      style={{
                        ...ovalStyle,
                        borderColor: ovalColor,
                      }}
                    />

                    <span className="acebedo-va-camera-status">
                      {pausedForPosition
                        ? "Move back"
                        : eyeCoverWarning
                          ? "Cover eye"
                          : faceStatus === "position-ok"
                            ? "Good"
                            : cameraReady
                              ? "Checking"
                              : "Starting"}
                    </span>
                  </>
                )}
              </div>

              {!localBaseline ? (
                <>
                  <div className="acebedo-va-spinner" aria-hidden="true" />
                  <h2 className="vision-test__blocked-title">Starting the test</h2>
                  <p className="vision-test__blocked-copy">
                    Stay in the position you set during setup.
                  </p>
                </>
              ) : (
                <>
                  <div className="vision-test__surface-label">Visual acuity</div>

                  <div className="vision-test__surface-eye">
                    {currentEye === "right" ? "OD · RIGHT EYE" : "OS · LEFT EYE"}
                  </div>

                  {!shouldLockTest && positionWarning && (
                    <div
                      className="acebedo-va-position-warning"
                      role="status"
                    >
                      {positionWarning}
                    </div>
                  )}

                  {!shouldLockTest && currentGeometry && currentOrientation && (
                    <div className="vision-test__acuity-stage">
                      <div
                        className="vision-test__acuity-optotype"
                        style={{
                          visibility: answerLocked ? "hidden" : "visible",
                        }}
                      >
                        <LandoltC
                          sizePx={clamp(
                            currentGeometry.diameterPx,
                            10,
                            MAX_DIAMETER_PX
                          )}
                          angle={currentOrientation.angle}
                        />
                      </div>

                      <p className="vision-test__surface-instruction">
                        Take your time. There’s no timer.
                      </p>
                    </div>
                  )}

                  {shouldLockTest && (
                    <div className="vision-test__blocked">
                      {pausedForPosition ? (
                        <>
                          <h2 className="vision-test__blocked-title">
                            Return to your viewing position
                          </h2>

                          <p className="vision-test__blocked-copy">
                            {movementReason ||
                              "Please return to the position where you started the screening."}
                          </p>

                          <p className="vision-test__blocked-copy">
                            Match your face to the outline below. The test resumes
                            automatically.
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="vision-test__blocked-title">
                            Cover your {currentEye === "right" ? "left" : "right"} eye
                          </h2>

                          <p className="vision-test__blocked-copy">
                            {eyeCoverWarning}
                          </p>

                          <p className="vision-test__blocked-copy">
                            Close the eye completely. You may cup your hand over it
                            for comfort, but keep the rest of your face visible.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {!shouldLockTest && feedback && (
                    <div className="vision-test__acuity-feedback" role="status">
                      {feedback}
                    </div>
                  )}
                </>
              )}
            </div>
          }
          responses={
            localBaseline ? (
              <div>
                <p className="vision-test__section-label">Choose a direction</p>
                <h2 className="vision-test__panel-title">
                  Which way is the opening?
                </h2>

                {!shouldLockTest && currentOrientation && (
                  <>
                    <div className="vision-test__response-grid">
                      {ANSWERS.map(({ id, label }) => {
                        const Icon = ARROW_ICONS[id];

                        return (
                          <button
                            key={id}
                            type="button"
                            className="vision-test__response-button"
                            aria-label={`Opening ${label}`}
                            onClick={() => handleAnswer(id)}
                            disabled={answerLocked}
                          >
                            <Icon
                              size={22}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        className="vision-test__response-button vision-test__response-button--secondary"
                        onClick={() => handleAnswer("unseen")}
                        disabled={answerLocked}
                      >
                        I can't see it
                      </button>
                    </div>

                    <div className="acebedo-va-keyboard-hint">
                      <span aria-hidden="true">⌨</span>
                      You can also use your arrow keys
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div>
                <p className="vision-test__section-label">Response</p>
                <p className="vision-test__panel-copy">
                  Direction choices will appear here when the assessment begins.
                </p>
              </div>
            )
          }
          footer={
            localBaseline ? (
              <div className="vision-test__support">
                <div className="vision-test__support-copy">
                  <InfoCircleIcon
                    size={17}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span>
                    Not sure? Choose “I can't see it” rather than guessing.
                  </span>
                </div>

                <button
                  type="button"
                  className="acebedo-va-pause"
                  disabled
                >
                  <PauseCircleIcon
                    size={17}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  Pause assessment
                </button>
              </div>
            ) : null
          }
        />
      </div>
    </section>
  );
}
