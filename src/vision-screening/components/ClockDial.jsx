import { useEffect, useMemo, useRef, useState } from "react";
import VisionTestLayout from "./VisionTestUI/VisionTestLayout";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  MEDIAPIPE,
  POSITION_MONITOR,
  SESSION_KEYS,
} from "../constants/screeningConfig";
import {
  getMovementMessage,
  getRelativeFaceMetrics,
  smoothMetrics,
} from "../utils/facePosition";
import {
  CheckCircleIcon,
  EyeIcon,
  InfoCircleIcon,
} from "@solar-icons/react/linear";

const EYES = ["right", "left"];
const RESULT_KEY = SESSION_KEYS.clockDial;
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const { wasmUrl: MEDIAPIPE_WASM_URL, modelUrl: FACE_MODEL_URL } = MEDIAPIPE;

const {
  checkIntervalMs: FACE_CHECK_INTERVAL,
  eyeCoveredThreshold: EYE_COVERED_THRESHOLD,
  warningConfirmMs: MOVEMENT_WARNING_CONFIRMATION_MS,
  pauseConfirmMs: MOVEMENT_PAUSE_CONFIRMATION_MS,
  faceLostMs: FACE_LOST_CONFIRMATION_MS,
  multipleFaceMs: MULTIPLE_FACE_CONFIRMATION_MS,
} = POSITION_MONITOR;

const {
  scale: WARNING_SCALE_TOLERANCE,
  x: WARNING_POSITION_TOLERANCE_X,
  y: WARNING_POSITION_TOLERANCE_Y,
} = POSITION_MONITOR.warning;

const {
  scale: PAUSE_SCALE_TOLERANCE,
  x: PAUSE_POSITION_TOLERANCE_X,
  y: PAUSE_POSITION_TOLERANCE_Y,
} = POSITION_MONITOR.pause;

const {
  scale: RESUME_SCALE_TOLERANCE,
  x: RESUME_POSITION_TOLERANCE_X,
  y: RESUME_POSITION_TOLERANCE_Y,
} = POSITION_MONITOR.resume;

const CAMERA = { width: 320, height: 180 };

function readSessionJson(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveResult(result) {
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    // Session storage is optional; parent callback still receives the result.
  }
}

/* Six lines through the centre create the 12 numbered clock-dial spokes. */
function Dial() {
  const size = 360;
  const center = size / 2;
  const lineRadius = size * 0.37;
  const labelRadius = size * 0.45;

  return (
    <svg
      className="vision-test__clock-dial"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Clock dial with twelve numbered lines"
    >
      {Array.from({ length: 6 }, (_, index) => index * 30).map((degrees) => {
        const radians = (degrees * Math.PI) / 180;

        return (
          <line
            key={degrees}
            x1={center - lineRadius * Math.sin(radians)}
            y1={center + lineRadius * Math.cos(radians)}
            x2={center + lineRadius * Math.sin(radians)}
            y2={center - lineRadius * Math.cos(radians)}
            stroke="#111111"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      {HOURS.map((hour) => {
        const radians = (hour * 30 * Math.PI) / 180;

        return (
          <text
            key={hour}
            x={center + labelRadius * Math.sin(radians)}
            y={center - labelRadius * Math.cos(radians)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fontWeight="500"
            fill="#111111"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {hour}
          </text>
        );
      })}

      <circle
        cx={center}
        cy={center}
        r="5"
        fill="var(--acebedo-red)"
        aria-hidden="true"
      />
    </svg>
  );
}

export default function ClockDial({ onContinue, onComplete }) {
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
  const savedBaselineRef = useRef(null);
  const localBaselineRef = useRef(null);
  const eyeCoverWarningRef = useRef("");
  const currentEyeRef = useRef(EYES[0]);

  const [viewingPosition] = useState(() =>
    readSessionJson(SESSION_KEYS.viewingPosition)
  );

  const [localBaseline, setLocalBaseline] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceTrackingReady, setFaceTrackingReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState("starting");
  const [positionWarning, setPositionWarning] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [pausedForPosition, setPausedForPosition] = useState(false);
  const [eyeCoverWarning, setEyeCoverWarning] = useState("");
  const [cameraError, setCameraError] = useState("");

  const [eyeIndex, setEyeIndex] = useState(0);
  const [step, setStep] = useState("compare");
  const [selected, setSelected] = useState([]);
  const [responses, setResponses] = useState([]);
  const [locked, setLocked] = useState(false);

  const currentEye = EYES[eyeIndex];
  const otherEye = currentEye === "right" ? "left" : "right";

  const eyeLabel = useMemo(
    () => (currentEye === "right" ? "OD · RIGHT EYE" : "OS · LEFT EYE"),
    [currentEye]
  );

  useEffect(() => {
    currentEyeRef.current = currentEye;
  }, [currentEye]);

  useEffect(() => {
    pausedForPositionRef.current = pausedForPosition;
  }, [pausedForPosition]);

  useEffect(() => {
    mountedRef.current = true;

    const measurement = viewingPosition?.measurement;

    if (
      measurement &&
      viewingPosition.frame?.width &&
      viewingPosition.frame?.height
    ) {
      savedBaselineRef.current = {
        metrics: {
          eyeDistance: measurement.baselineEyeDistance,
          faceWidth: measurement.baselineFaceWidth,
          faceHeight: measurement.baselineFaceHeight,
          centerX: measurement.baselineCenterX,
          centerY: measurement.baselineCenterY,
        },
        aspect:
          viewingPosition.frame.width / viewingPosition.frame.height,
      };
    }

    if (!savedBaselineRef.current) {
      setCameraError(
        "Your viewing position was not found. Please complete Environment Setup first."
      );
    }

    return () => {
      mountedRef.current = false;

      if (faceAnimationRef.current) {
        cancelAnimationFrame(faceAnimationRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [viewingPosition]);

  async function startCameraAndTracking() {
    try {
      setCameraError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: CAMERA.width },
          height: { ideal: CAMERA.height },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);

      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_WASM_URL
      );

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate: "GPU",
        },
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
      console.error("Clock dial camera/tracking error:", error);
      setFaceStatus("error");
      setCameraError(
        "Camera or face tracking could not start. Please allow camera access and try again."
      );
    }
  }

  useEffect(() => {
    if (!savedBaselineRef.current) return;
    startCameraAndTracking();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!faceTrackingReady || !faceLandmarkerRef.current) return;

    let stopped = false;

    const clearMovementTimers = () => {
      movementWarningStartedRef.current = null;
      movementPauseStartedRef.current = null;
      faceLostStartedRef.current = null;
      multipleFaceStartedRef.current = null;
    };

    const isPositionRestored = (metrics, baseline) =>
      Math.abs(metrics.eyeDistance / baseline.eyeDistance - 1) <=
        RESUME_SCALE_TOLERANCE &&
      Math.abs(metrics.centerX - baseline.centerX) <=
        RESUME_POSITION_TOLERANCE_X &&
      Math.abs(metrics.centerY - baseline.centerY) <=
        RESUME_POSITION_TOLERANCE_Y;

    function pauseFor(reason) {
      pausedForPositionRef.current = true;
      setPausedForPosition(true);
      setPositionWarning("");
      setMovementReason(reason);
      setLocked(true);
    }

    function detectFaceFrame(now) {
      if (stopped) return;

      faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);

      if (now - lastFaceDetectionRef.current < FACE_CHECK_INTERVAL) return;
      lastFaceDetectionRef.current = now;

      const video = videoRef.current;
      const landmarker = faceLandmarkerRef.current;

      if (
        !video ||
        !landmarker ||
        video.readyState < 2 ||
        video.videoWidth <= 0
      ) {
        return;
      }

      try {
        const result = landmarker.detectForVideo(video, now);
        const faces = result?.faceLandmarks || [];

        if (faces.length === 0) {
          setFaceStatus("not-detected");
          multipleFaceStartedRef.current = null;

          if (!faceLostStartedRef.current) {
            faceLostStartedRef.current = now;
          }

          if (
            now - faceLostStartedRef.current >= FACE_LOST_CONFIRMATION_MS &&
            !pausedForPositionRef.current
          ) {
            pauseFor(
              "We can't see your face clearly. Please face the camera and return to your viewing distance."
            );
          }

          return;
        }

        if (faces.length > 1) {
          setFaceStatus("multiple");
          faceLostStartedRef.current = null;

          if (!multipleFaceStartedRef.current) {
            multipleFaceStartedRef.current = now;
          }

          if (
            now - multipleFaceStartedRef.current >=
              MULTIPLE_FACE_CONFIRMATION_MS &&
            !pausedForPositionRef.current
          ) {
            pauseFor("Only one face should be visible during the screening.");
          }

          return;
        }

        faceLostStartedRef.current = null;
        multipleFaceStartedRef.current = null;

        const metrics = getRelativeFaceMetrics(faces[0]);
        if (!metrics) return;

        const smoothed = smoothMetrics(
          smoothedMetricsRef.current,
          metrics
        );
        smoothedMetricsRef.current = smoothed;

        let coverWarning = "";

        const blendshapes = result.faceBlendshapes?.[0]?.categories;

        if (blendshapes && localBaselineRef.current) {
          const rawLeft =
            blendshapes.find(
              (category) => category.categoryName === "eyeBlinkLeft"
            )?.score || 0;
          const rawRight =
            blendshapes.find(
              (category) => category.categoryName === "eyeBlinkRight"
            )?.score || 0;

          if (!smoothed.blink) {
            smoothed.blink = { left: rawLeft, right: rawRight };
          }

          smoothed.blink.left =
            smoothed.blink.left * 0.85 + rawLeft * 0.15;
          smoothed.blink.right =
            smoothed.blink.right * 0.85 + rawRight * 0.15;

          const left = smoothed.blink.left;
          const right = smoothed.blink.right;

          if (currentEyeRef.current === "right") {
            if (left < EYE_COVERED_THRESHOLD) {
              coverWarning = "Please close your left eye to continue.";
            } else if (right > EYE_COVERED_THRESHOLD) {
              coverWarning = "Please keep your testing eye (right) open.";
            }
          } else {
            if (right < EYE_COVERED_THRESHOLD) {
              coverWarning = "Please close your right eye to continue.";
            } else if (left > EYE_COVERED_THRESHOLD) {
              coverWarning = "Please keep your testing eye (left) open.";
            }
          }
        }

        if (coverWarning !== eyeCoverWarningRef.current) {
          eyeCoverWarningRef.current = coverWarning;
          setEyeCoverWarning(coverWarning);

          if (coverWarning) {
            setLocked(true);
          } else if (!pausedForPositionRef.current) {
            setLocked(false);
          }
        }

        if (!localBaselineRef.current) {
          const saved = savedBaselineRef.current;

          if (!saved) {
            pauseFor(
              "Your viewing position was not found. Please complete Environment Setup first."
            );
            return;
          }

          if (
            Math.abs(
              video.videoWidth / video.videoHeight - saved.aspect
            ) > 0.05
          ) {
            setCameraError(
              "The camera settings changed since setup. Please complete Environment Setup again."
            );
            pauseFor("The camera view changed since setup.");
            return;
          }

          localBaselineRef.current = saved.metrics;
          setLocalBaseline(saved.metrics);

          if (isPositionRestored(smoothed, saved.metrics)) {
            setFaceStatus("position-ok");
          } else {
            setFaceStatus("reposition");
            pauseFor(
              "Please sit back in the position you set during setup."
            );
          }

          return;
        }

        const baseline = localBaselineRef.current;
        const scaleRatio = smoothed.eyeDistance / baseline.eyeDistance;
        const scaleDev = Math.abs(scaleRatio - 1);
        const xDev = Math.abs(smoothed.centerX - baseline.centerX);
        const yDev = Math.abs(smoothed.centerY - baseline.centerY);

        const warningExceeded =
          scaleDev > WARNING_SCALE_TOLERANCE ||
          xDev > WARNING_POSITION_TOLERANCE_X ||
          yDev > WARNING_POSITION_TOLERANCE_Y;

        const pauseExceeded =
          scaleDev > PAUSE_SCALE_TOLERANCE ||
          xDev > PAUSE_POSITION_TOLERANCE_X ||
          yDev > PAUSE_POSITION_TOLERANCE_Y;

        if (
          pausedForPositionRef.current &&
          isPositionRestored(smoothed, baseline) &&
          !coverWarning
        ) {
          clearMovementTimers();
          pausedForPositionRef.current = false;
          setPausedForPosition(false);
          setMovementReason("");
          setPositionWarning("");
          setLocked(false);
          setFaceStatus("position-ok");
          return;
        }

        if (!warningExceeded) {
          clearMovementTimers();
          setFaceStatus(
            pausedForPositionRef.current ? "reposition" : "position-ok"
          );

          if (!pausedForPositionRef.current) {
            setPositionWarning("");
          }

          return;
        }

        setFaceStatus("reposition");

        if (!movementWarningStartedRef.current) {
          movementWarningStartedRef.current = now;
        }

        if (
          now - movementWarningStartedRef.current >=
          MOVEMENT_WARNING_CONFIRMATION_MS
        ) {
          setPositionWarning(
            pauseExceeded
              ? "Please return to your viewing distance."
              : "Stay roughly at your viewing distance."
          );
        }

        if (pauseExceeded) {
          if (!movementPauseStartedRef.current) {
            movementPauseStartedRef.current = now;
          }

          if (
            now - movementPauseStartedRef.current >=
              MOVEMENT_PAUSE_CONFIRMATION_MS &&
            !pausedForPositionRef.current
          ) {
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
        console.error("Clock dial face detection error:", error);
      }
    }

    faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);

    return () => {
      stopped = true;
      if (faceAnimationRef.current) {
        cancelAnimationFrame(faceAnimationRef.current);
      }
    };
  }, [faceTrackingReady]);

  const shouldLockTest =
    !localBaseline ||
    pausedForPosition ||
    !!eyeCoverWarning ||
    !!cameraError;

  const statusLabel = pausedForPosition
    ? "Paused"
    : positionWarning
      ? "Adjust position"
      : "Position good";

  const statusToneClass = pausedForPosition
    ? "is-bad"
    : positionWarning
      ? "is-warn"
      : "";

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

  const ovalColor =
    pausedForPosition
      ? "var(--acebedo-red)"
      : faceStatus === "position-ok"
        ? "rgba(33,201,151,.95)"
        : "rgba(255,255,255,.85)";

  function finish(nextResponses) {
    const result = {
      completedAt: new Date().toISOString(),
      method: "digital-clock-dial-pattern-screen",
      validationStatus: "engineering-prototype-not-clinically-validated",
      viewingPosition: {
        established: Boolean(viewingPosition),
        monitoring: "relative-face-position",
        validationStatus: "engineering-prototype-not-clinically-validated",
      },
      eyes: nextResponses,
    };

    saveResult(result);

    if (onComplete) onComplete(result);
    if (onContinue) onContinue(result);
  }

  function completeEye(equal, lines = []) {
    if (shouldLockTest || locked) return;

    const nextResponses = [
      ...responses,
      {
        eye: currentEye,
        equal,
        lines,
        timestamp: new Date().toISOString(),
      },
    ];

    setResponses(nextResponses);
    setSelected([]);
    setStep("compare");

    if (eyeIndex >= EYES.length - 1) {
      setLocked(true);
      finish(nextResponses);
      return;
    }

    eyeCoverWarningRef.current = "";
    setEyeCoverWarning("");
    setEyeIndex((value) => value + 1);
  }

  function handleEqual() {
    completeEye(true, []);
  }

  function handleNotEqual() {
    if (shouldLockTest || locked) return;
    setSelected([]);
    setStep("numbers");
  }

  function toggleHour(hour) {
    if (shouldLockTest || locked) return;

    setSelected((current) =>
      current.includes(hour)
        ? current.filter((value) => value !== hour)
        : [...current, hour].sort((a, b) => a - b)
    );
  }

  function handleNextNumbers() {
    if (shouldLockTest || locked || selected.length === 0) return;
    completeEye(false, selected);
  }

  function handleSkipNumbers() {
    if (shouldLockTest || locked) return;
    completeEye(false, []);
  }

  return (
    <section className="acebedo-page">
      <div className="acebedo-container py-8 md:py-12">
        <VisionTestLayout
          eyebrow="Distance vision / clock dial"
          title="Clock Dial Test"
          instruction="Look at the centre of the dial and compare the lines."
          status={
            <div>
              <div
                className={`acebedo-va-position-status ${statusToneClass}`}
              >
                <span
                  className="acebedo-va-position-dot"
                  aria-hidden="true"
                />
                <span className="acebedo-va-position-label">
                  {statusLabel}
                </span>
              </div>
              <div className="acebedo-va-position-help">
                Keep your current distance.
              </div>
            </div>
          }
          assessment={
            <div>
              <p className="vision-test__section-label">Your assessment</p>

              <div className="vision-test__eye-list">
                {EYES.map((eye, index) => {
                  const active = index === eyeIndex;
                  const complete = index < eyeIndex;

                  return (
                    <div
                      key={eye}
                      className={`vision-test__eye-status ${
                        active ? "vision-test__eye-status--active" : ""
                      } ${
                        complete
                          ? "vision-test__eye-status--complete"
                          : ""
                      }`}
                    >
                      <div className="vision-test__eye-status-name">
                        {complete ? (
                          <CheckCircleIcon
                            size={18}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="vision-test__eye-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        )}
                        {eye === "right" ? "Right Eye" : "Left Eye"}
                      </div>

                      <div className="vision-test__eye-status-state">
                        {active
                          ? "In progress"
                          : complete
                            ? "Complete"
                            : "Up next"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="acebedo-va-cover-note">
                <EyeIcon
                  size={22}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <h2>Cover your {otherEye} eye.</h2>
                <p>
                  Keep your {currentEye} eye open. Rest your hand gently
                  over the other eye without pressing.
                </p>
              </div>
            </div>
          }
          testSurface={
            <div className="vision-test__surface-content vision-test__clock-surface">
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
                <video ref={videoRef} muted playsInline />

                {shouldLockTest && (
                  <>
                    <div
                      className="acebedo-va-camera-oval"
                      style={{
                        borderColor: ovalColor,
                        ...ovalStyle,
                      }}
                    />
                    <span className="acebedo-va-camera-status">
                      {pausedForPosition
                        ? "Move back"
                        : eyeCoverWarning
                          ? "Cover eye"
                          : cameraError
                            ? "Camera error"
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
                <div className="vision-test__blocked">
                  <h2 className="vision-test__blocked-title">
                    Checking your viewing position
                  </h2>
                  <p className="vision-test__blocked-copy">
                    {cameraError ||
                      "Stay in the position you set during setup. The test will begin automatically."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="vision-test__surface-label">Clock Dial</div>
                  <div className="vision-test__surface-eye">{eyeLabel}</div>

                  {!shouldLockTest && positionWarning && (
                    <div
                      className="acebedo-va-position-warning"
                      role="status"
                    >
                      {positionWarning}
                    </div>
                  )}

                  {!shouldLockTest && (
                    <>
                      <Dial />
                      <p className="vision-test__surface-instruction">
                        Take your time. Focus on the centre.
                      </p>
                    </>
                  )}

                  {shouldLockTest && localBaseline && (
                    <div className="vision-test__blocked">
                      {cameraError ? (
                        <>
                          <h2 className="vision-test__blocked-title">
                            Camera check unavailable
                          </h2>
                          <p className="vision-test__blocked-copy">
                            {cameraError}
                          </p>
                        </>
                      ) : pausedForPosition ? (
                        <>
                          <h2 className="vision-test__blocked-title">
                            Return to your viewing position
                          </h2>
                          <p className="vision-test__blocked-copy">
                            {movementReason ||
                              "Please return to the position where you started the screening."}
                          </p>
                          <p className="vision-test__blocked-copy">
                            Match your face to the outline. The test
                            resumes automatically.
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="vision-test__blocked-title">
                            Cover your {otherEye} eye
                          </h2>
                          <p className="vision-test__blocked-copy">
                            {eyeCoverWarning}
                          </p>
                          <p className="vision-test__blocked-copy">
                            Close the eye completely. You may cup your
                            hand over it for comfort, but keep the rest
                            of your face visible.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          }
          responses={
            <div>
              <p className="vision-test__section-label">Compare the lines</p>

              {step === "compare" ? (
                <>
                  <h2 className="vision-test__panel-title">
                    Look at the lines
                  </h2>

                  <p className="vision-test__panel-copy">
                    Look at the centre of the dial for a few seconds.
                    Do all the lines look equally dark and sharp?
                  </p>

                  <div className="vision-test__clock-choices">
                    <button
                      type="button"
                      className="vision-test__clock-choice"
                      onClick={handleEqual}
                      disabled={shouldLockTest || locked}
                    >
                      <span
                        className="vision-test__clock-radio"
                        aria-hidden="true"
                      />
                      <span>Yes, all look equal</span>
                    </button>

                    <button
                      type="button"
                      className="vision-test__clock-choice"
                      onClick={handleNotEqual}
                      disabled={shouldLockTest || locked}
                    >
                      <span
                        className="vision-test__clock-radio"
                        aria-hidden="true"
                      />
                      <span>No, some look darker or sharper</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="vision-test__panel-title">
                    Which lines look different?
                  </h2>

                  <p className="vision-test__panel-copy">
                    Select the number of each line that looks darker or
                    sharper.
                  </p>

                  <div
                    className="vision-test__clock-number-grid"
                    aria-label="Clock line numbers"
                  >
                    {HOURS.map((hour) => {
                      const isSelected = selected.includes(hour);

                      return (
                        <button
                          key={hour}
                          type="button"
                          className={`vision-test__clock-number ${
                            isSelected
                              ? "vision-test__clock-number--selected"
                              : ""
                          }`}
                          onClick={() => toggleHour(hour)}
                          aria-pressed={isSelected}
                          disabled={shouldLockTest || locked}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>

                  <div className="vision-test__clock-number-actions">
                    <button
                      type="button"
                      className="vision-test__clock-next"
                      onClick={handleNextNumbers}
                      disabled={
                        shouldLockTest ||
                        locked ||
                        selected.length === 0
                      }
                    >
                      Next
                    </button>

                    <button
                      type="button"
                      className="vision-test__clock-skip"
                      onClick={handleSkipNumbers}
                      disabled={shouldLockTest || locked}
                    >
                      Skip this
                    </button>
                  </div>
                </>
              )}

              <p className="vision-test__clock-help">
                {step === "compare"
                  ? "Choose the option that best matches what you see."
                  : "Select every number that looks darker or sharper."}
              </p>
            </div>
          }
          footer={
            <div className="vision-test__support">
              <div className="vision-test__support-copy">
                <InfoCircleIcon
                  size={17}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span>
                  {step === "compare"
                    ? "If the lines look equal, choose “Yes, all look equal”."
                    : "If you're not sure, choose “Skip this”."}
                </span>
              </div>

              <button
                type="button"
                className="vision-test__pause-button"
                disabled
              >
                <span aria-hidden="true">Ⅱ</span>
                Pause assessment
              </button>
            </div>
          }
        />
      </div>
    </section>
  );
}
