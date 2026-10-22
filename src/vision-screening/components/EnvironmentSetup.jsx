import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import cvReadyPromise from "@techstark/opencv-js";
import { CAMERA, CARD, MEDIAPIPE, POSITION_MONITOR, SESSION_KEYS, SETUP } from "../constants/screeningConfig";
import { CameraIcon, CardIcon, UserIcon, CheckCircleIcon } from "@solar-icons/react/linear";
import { clamp, distance } from "../utils/acuityMath";
import { getRelativeFaceMetrics } from "../utils/facePosition";

/* Values come from constants/screeningConfig.js. Edit them there. */
const { widthMm: CARD_WIDTH_MM, heightMm: CARD_HEIGHT_MM } = CARD;
const CARD_RATIO = CARD_WIDTH_MM / CARD_HEIGHT_MM;
const { wasmUrl: MEDIAPIPE_WASM_URL, modelUrl: FACE_MODEL_URL } = MEDIAPIPE;
const {
  analysisWidth: ANALYSIS_WIDTH,
  analysisHeight: ANALYSIS_HEIGHT,
  faceDetectionIntervalMs: FACE_DETECTION_INTERVAL,
  cardDetectionIntervalMs: CARD_DETECTION_INTERVAL,
  faceStableMs: FACE_STABLE_TIME,
  positioningGraceMs: FACE_POSITIONING_GRACE_TIME,
  faceTargetMinGuideRatio: FACE_TARGET_MIN_GUIDE_RATIO,
  faceTargetMaxGuideRatio: FACE_TARGET_MAX_GUIDE_RATIO,
  faceCenterToleranceX: FACE_CENTER_TOLERANCE_X,
  faceCenterToleranceY: FACE_CENTER_TOLERANCE_Y,
  faceMinLandmarks: FACE_MIN_LANDMARKS,
  cardStableMs: CARD_STABLE_TIME,
  completeDelayMs: COMPLETE_DELAY_MS,
  cardAlignment: CARD_ALIGNMENT,
} = SETUP;

/* Face status -> [badge text, instruction text] */
const FACE_HINTS = {
  too_far: ["Move closer", "Move a little closer until your face fits the guide."],
  too_close: ["Move farther", "Move a little farther back until your face fits the guide."],
  move_left: ["Move left", "Move slightly to your left."],
  move_right: ["Move right", "Move slightly to your right."],
  move_up: ["Move up", "Raise your head slightly."],
  move_down: ["Move down", "Lower your head slightly."],
  incomplete: ["Show your full face", "Keep your full face visible and face the camera directly."],
  multiple: ["Multiple faces", "Only one person should be visible in the camera."],
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export default function EnvironmentSetup({ onContinue, onComplete }) {
  const videoRef = useRef(null);
  const cameraContainerRef = useRef(null);
  const guideRef = useRef(null);
  const faceGuideRef = useRef(null);
  const processingCanvasRef = useRef(null);

  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const openCvRef = useRef(null);
  const faceAnimationRef = useRef(null);
  const cardAnimationRef = useRef(null);
  const lastFaceDetectionRef = useRef(0);
  const lastCardDetectionRef = useRef(0);
  const faceStableSinceRef = useRef(null);
  const faceSetupReadyRef = useRef(false);
  const faceBaselineRef = useRef(null);
  const cardStableSinceRef = useRef(null);
  const phaseRef = useRef("card");
  const calibrationRef = useRef(null);
  const faceSamplesRef = useRef([]);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState("card");
  const [cameraStatus, setCameraStatus] = useState("loading");
  const [faceStatus, setFaceStatus] = useState("loading");
  const [facePositionStatus, setFacePositionStatus] = useState("searching");
  const [faceSetupCountdown, setFaceSetupCountdown] = useState(5);
  const [faceCount, setFaceCount] = useState(0);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [openCvStatus, setOpenCvStatus] = useState("loading");
  const [cardStatus, setCardStatus] = useState("waiting");
  const [cardAligned, setCardAligned] = useState(false);
  const [cardCandidate, setCardCandidate] = useState(null);
  const [calibrationResult, setCalibrationResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* Fresh viewing-position baseline for every session */
  useEffect(() => {
    faceBaselineRef.current = null;
    try { sessionStorage.removeItem(SESSION_KEYS.viewingPosition); } catch { /* ignore */ }
  }, []);

  /* 5-second positioning window before a baseline may be set */
  useEffect(() => {
    if (cameraStatus !== "ready" || phase !== "face") {
      faceSetupReadyRef.current = false;
      setFaceSetupCountdown(5);
      return;
    }
    let stopped = false;
    const startedAt = performance.now();
    faceSetupReadyRef.current = false;
    setFaceSetupCountdown(5);
    setFacePositionStatus("settling");

    const tick = () => {
      if (stopped) return;
      const remaining = Math.max(0, FACE_POSITIONING_GRACE_TIME - (performance.now() - startedAt));
      if (remaining <= 0) {
        faceSetupReadyRef.current = true;
        setFaceSetupCountdown(0);
        setFacePositionStatus("searching");
        return;
      }
      setFaceSetupCountdown(Math.ceil(remaining / 1000));
      requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [cameraStatus, phase]);

  /* Camera */
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function startCamera() {
      try {
        setCameraStatus("loading");
        setError("");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported by this browser.");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: CAMERA.width }, height: { ideal: CAMERA.height }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview element is unavailable.");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        await video.play();
        if (!mountedRef.current) return;
        setCameraStatus("ready");
      } catch (cameraError) {
        console.error("Unable to start camera:", cameraError);
        if (!mountedRef.current) return;
        setCameraStatus("error");
        setError(cameraError?.message || "Unable to access the camera.");
      }
    }
    startCamera();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  /* MediaPipe Face Landmarker */
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setFaceStatus("loading");
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        if (cancelled) return;
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.7,
          minFacePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
        if (cancelled) {
          landmarker.close?.();
          return;
        }
        faceLandmarkerRef.current = landmarker;
        setFaceStatus("ready");
      } catch (e) {
        console.error("Unable to initialize Face Landmarker:", e);
        if (!mountedRef.current) return;
        setFaceStatus("error");
        setError("Face tracking could not be initialized. Please refresh the page and try again.");
      }
    }
    init();
    return () => {
      cancelled = true;
      if (faceLandmarkerRef.current) {
        try { faceLandmarkerRef.current.close?.(); } catch { /* ignore */ }
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  /* OpenCV */
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setOpenCvStatus("loading");
        const cv = await cvReadyPromise;
        if (cancelled) return;
        if (!cv || typeof cv.Mat !== "function") throw new Error("OpenCV API unavailable.");
        openCvRef.current = cv;
        setOpenCvStatus("ready");
      } catch (e) {
        console.error("Unable to initialize OpenCV:", e);
        if (mountedRef.current) setOpenCvStatus("error");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  /* Face tracking loop */
  useEffect(() => {
    if (cameraStatus !== "ready" || faceStatus !== "ready" || phase !== "face") return;
    let stopped = false;

    function detectFaceFrame(now) {
      if (stopped) return;
      const video = videoRef.current;
      const landmarker = faceLandmarkerRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
        return;
      }
      if (phaseRef.current !== "face") return;
      if (now - lastFaceDetectionRef.current < FACE_DETECTION_INTERVAL) {
        faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
        return;
      }
      lastFaceDetectionRef.current = now;

      try {
        const result = landmarker.detectForVideo(video, now);
        const faces = result?.faceLandmarks || [];
        const count = faces.length;
        if (!mountedRef.current) return;

        setFaceCount((prev) => (prev === count ? prev : count));
        const faceLandmarks = count === 1 ? faces[0] || [] : [];
        setLandmarkCount(faceLandmarks.length);

        if (!faceSetupReadyRef.current) {
          faceStableSinceRef.current = null;
          setFacePositionStatus("settling");
        } else if (count !== 1) {
          faceStableSinceRef.current = null;
          setFacePositionStatus(count > 1 ? "multiple" : "searching");
        } else if (faceLandmarks.length < FACE_MIN_LANDMARKS) {
          faceStableSinceRef.current = null;
          setFacePositionStatus("incomplete");
        } else {
          const guide = faceGuideRef.current;
          const container = cameraContainerRef.current;
          let positionStatus = "ready";

          if (guide && container) {
            const g = guide.getBoundingClientRect();
            const c = container.getBoundingClientRect();
            const xs = faceLandmarks.map((p) => p.x);
            const ys = faceLandmarks.map((p) => p.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const faceCenterX = (minX + maxX) / 2;
            const faceCenterY = (minY + maxY) / 2;
            const faceWidth = maxX - minX;

            const guideWidth = g.width / c.width;
            const guideHeight = g.height / c.height;
            const guideCenterX = (g.left - c.left) / c.width + guideWidth / 2;
            const guideCenterY = (g.top - c.top) / c.height + guideHeight / 2;

            const ratio = faceWidth / guideWidth;
            const offsetX = Math.abs(faceCenterX - guideCenterX) / guideWidth;
            const offsetY = Math.abs(faceCenterY - guideCenterY) / guideHeight;

            if (ratio < FACE_TARGET_MIN_GUIDE_RATIO) positionStatus = "too_far";
            else if (ratio > FACE_TARGET_MAX_GUIDE_RATIO) positionStatus = "too_close";
            else if (offsetX > FACE_CENTER_TOLERANCE_X) positionStatus = faceCenterX < guideCenterX ? "move_right" : "move_left";
            else if (offsetY > FACE_CENTER_TOLERANCE_Y) positionStatus = faceCenterY < guideCenterY ? "move_down" : "move_up";
          }

          setFacePositionStatus(positionStatus);

          if (positionStatus === "ready") {
            if (faceStableSinceRef.current === null) {
              faceStableSinceRef.current = performance.now();
              faceSamplesRef.current = [];
            }
            const sample = getRelativeFaceMetrics(faceLandmarks);
            if (sample) faceSamplesRef.current.push(sample);

            if (performance.now() - faceStableSinceRef.current >= FACE_STABLE_TIME) {
              const samples = faceSamplesRef.current;
              if (samples.length < 3) {
                faceStableSinceRef.current = null;
                setFacePositionStatus("incomplete");
                return;
              }
              // Average the whole stable window instead of trusting a single frame
              const mean = (key) => samples.reduce((sum, m) => sum + m[key], 0) / samples.length;
              const baseline = {
                eyeDistance: mean("eyeDistance"),
                faceWidth: mean("faceWidth"),
                faceHeight: mean("faceHeight"),
                centerX: mean("centerX"),
                centerY: mean("centerY"),
              };
              faceBaselineRef.current = baseline;
              try {
                sessionStorage.setItem(
                  SESSION_KEYS.viewingPosition,
                  JSON.stringify({
                    establishedAt: new Date().toISOString(),
                    relativePosition: "guide-centered",
                    monitoring: "relative-face-position",
                    frame: { width: video.videoWidth, height: video.videoHeight },
                    measurement: {
                      scaleMetric: "normalized-inter-eye-distance",
                      baselineEyeDistance: baseline.eyeDistance,
                      baselineFaceWidth: baseline.faceWidth,
                      baselineFaceHeight: baseline.faceHeight,
                      baselineCenterX: baseline.centerX,
                      baselineCenterY: baseline.centerY,
                    },
                    monitoringThresholds: {
                      warning: POSITION_MONITOR.warning,
                      pause: POSITION_MONITOR.pause,
                      resume: POSITION_MONITOR.resume,
                      pauseConfirmMs: POSITION_MONITOR.pauseConfirmMs,
                    },
                    validationStatus: "engineering-prototype-not-clinically-validated",
                  })
                );
              } catch { /* ignore */ }

              faceStableSinceRef.current = null;
              faceSamplesRef.current = [];
              phaseRef.current = "complete";
              setPhase("complete");
              setError("");

              const result = { ...(calibrationRef.current || {}), viewingPosition: baseline };
              setTimeout(() => {
                if (!mountedRef.current) return;
                if (typeof onComplete === "function") onComplete(result);
                else if (typeof onContinue === "function") onContinue(result);
              }, COMPLETE_DELAY_MS);
            }
          } else {
            faceStableSinceRef.current = null;
            faceSamplesRef.current = [];
          }
        }
      } catch (e) {
        console.error("Face detection error:", e);
      }
      faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
    }

    faceAnimationRef.current = requestAnimationFrame(detectFaceFrame);
    return () => {
      stopped = true;
      if (faceAnimationRef.current) {
        cancelAnimationFrame(faceAnimationRef.current);
        faceAnimationRef.current = null;
      }
    };
  }, [cameraStatus, faceStatus, phase]);

  /* Guide rectangle in analysis-canvas coordinates (video is mirrored) */
  function getGuideInVideoCoordinates() {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (!video || !guide) return null;
    const v = video.getBoundingClientRect();
    const g = guide.getBoundingClientRect();
    if (v.width <= 0 || v.height <= 0) return null;

    const sx = ANALYSIS_WIDTH / v.width;
    const sy = ANALYSIS_HEIGHT / v.height;
    const x = ANALYSIS_WIDTH - (g.left - v.left + g.width) * sx;
    const y = (g.top - v.top) * sy;
    const width = g.width * sx;
    const height = g.height * sy;
    return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
  }

  /* Card detection (OpenCV) */
  function detectCardFromVideo() {
    const cv = openCvRef.current;
    const video = videoRef.current;
    const canvas = processingCanvasRef.current;
    if (!cv || !video || !canvas) return null;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const guide = getGuideInVideoCoordinates();
    if (!guide) return null;

    canvas.width = ANALYSIS_WIDTH;
    canvas.height = ANALYSIS_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    let src = null, gray = null, blurred = null, edges = null, closed = null, contours = null, hierarchy = null, kernel = null;

    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      blurred = new cv.Mat();
      edges = new cv.Mat();
      closed = new cv.Mat();
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
      cv.Canny(blurred, edges, 40, 150);
      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
      cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const frameArea = ANALYSIS_WIDTH * ANALYSIS_HEIGHT;
      const guideDiagonal = Math.hypot(guide.width, guide.height);
      let best = null;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        let approx = null;
        try {
          const perimeter = cv.arcLength(contour, true);
          if (perimeter <= 0) continue;

          approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, perimeter * 0.04, true);
          if (approx.rows < 4 || approx.rows > 12) continue;

          const rect = cv.boundingRect(approx);
          if (rect.width <= 0 || rect.height <= 0) continue;

          const areaRatio = cv.contourArea(approx) / frameArea;
          if (areaRatio < 0.03 || areaRatio > 0.9) continue;

          const rectAspect = Math.max(rect.width, rect.height) / Math.min(rect.width, rect.height);
          const aspectError = Math.abs(rectAspect / CARD_RATIO - 1);
          if (aspectError > 0.4) continue;

          const cx = rect.x + rect.width / 2;
          const cy = rect.y + rect.height / 2;
          const centerDistance = distance(cx, cy, guide.centerX, guide.centerY);
          if (centerDistance > guideDiagonal * 1.5) continue;

          const widthRatio = rect.width / guide.width;
          const heightRatio = rect.height / guide.height;
          if (widthRatio < 0.25 || widthRatio > 2.5 || heightRatio < 0.25 || heightRatio > 2.5) continue;

          const aspectScore = clamp(1 - aspectError / 0.4, 0, 1);
          const sizeError = (Math.abs(widthRatio - 1) + Math.abs(heightRatio - 1)) / 2;
          const sizeScore = clamp(1 - sizeError / 0.5, 0, 1);
          const centerScore = clamp(1 - centerDistance / (guideDiagonal * 1.5), 0, 1);
          const score = aspectScore * 0.5 + sizeScore * 0.25 + centerScore * 0.25;

          if (!best || score > best.score) {
            best = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, score, aspectError, centerDistance };
          }
        } finally {
          if (approx) approx.delete();
          contour.delete();
        }
      }
      return best;
    } finally {
      [src, gray, blurred, edges, closed, contours, hierarchy, kernel].forEach((m) => m && m.delete());
    }
  }

  function evaluateCardAlignment(candidate) {
    const guide = getGuideInVideoCoordinates();
    if (!candidate || !guide) return false;
    const centerError =
      distance(candidate.x + candidate.width / 2, candidate.y + candidate.height / 2, guide.centerX, guide.centerY) /
      Math.max(guide.width, guide.height);
    const widthError = Math.abs(candidate.width / guide.width - 1);
    const heightError = Math.abs(candidate.height / guide.height - 1);
    return (
      centerError <= CARD_ALIGNMENT.center &&
      widthError <= CARD_ALIGNMENT.size &&
      heightError <= CARD_ALIGNMENT.size &&
      candidate.aspectError <= CARD_ALIGNMENT.aspect
    );
  }

  /* Card detection loop */
  useEffect(() => {
    if (phase !== "card" || cameraStatus !== "ready") return;
    if (openCvStatus !== "ready") {
      setCardStatus("loading");
      return;
    }
    let stopped = false;

    function detectCardFrame(now) {
      if (stopped || phaseRef.current !== "card") return;
      if (now - lastCardDetectionRef.current < CARD_DETECTION_INTERVAL) {
        cardAnimationRef.current = requestAnimationFrame(detectCardFrame);
        return;
      }
      lastCardDetectionRef.current = now;

      try {
        const candidate = detectCardFromVideo();
        if (!mountedRef.current) return;

        if (!candidate) {
          setCardCandidate(null);
          setCardAligned(false);
          setCardStatus("waiting");
          cardStableSinceRef.current = null;
        } else {
          setCardCandidate(candidate);
          if (evaluateCardAlignment(candidate)) {
            setCardAligned(true);
            setCardStatus("aligned");
            if (cardStableSinceRef.current === null) cardStableSinceRef.current = performance.now();
            if (performance.now() - cardStableSinceRef.current >= CARD_STABLE_TIME) {
              finishCalibration();
              return;
            }
          } else {
            setCardAligned(false);
            setCardStatus("detected");
            cardStableSinceRef.current = null;
          }
        }
      } catch (e) {
        console.error("Card detection error:", e);
        setCardStatus("error");
        setCardAligned(false);
        cardStableSinceRef.current = null;
      }
      cardAnimationRef.current = requestAnimationFrame(detectCardFrame);
    }

    setCardStatus("waiting");
    cardAnimationRef.current = requestAnimationFrame(detectCardFrame);
    return () => {
      stopped = true;
      if (cardAnimationRef.current) {
        cancelAnimationFrame(cardAnimationRef.current);
        cardAnimationRef.current = null;
      }
    };
  }, [phase, cameraStatus, openCvStatus]);

  function finishCalibration() {
    if (phaseRef.current !== "card") return;
    const guideWidthCssPx = guideRef.current?.getBoundingClientRect()?.width || 0;
    if (guideWidthCssPx <= 0) return;

    const result = {
      pixelsPerMm: guideWidthCssPx / CARD_WIDTH_MM,
      cardWidthMm: CARD_WIDTH_MM,
      cardHeightMm: CARD_HEIGHT_MM,
      cardWidthCssPx: guideWidthCssPx,
      devicePixelRatio: window.devicePixelRatio || 1,
      browserZoomIndicator: window.devicePixelRatio || 1,
      calibratedAt: new Date().toISOString(),
    };
    try { sessionStorage.setItem(SESSION_KEYS.calibration, JSON.stringify(result)); } catch { /* ignore */ }

    calibrationRef.current = result;
    setCalibrationResult(result);
    setCardAligned(true);
    setCardStatus("complete");

    // Short "calibrated" confirmation, then move on to the face position step
    setTimeout(() => {
      if (!mountedRef.current) return;
      phaseRef.current = "face";
      setPhase("face");
      setError("");
    }, 1000);
  }

  function retryCardDetection() {
    setError("");
    setCardStatus("waiting");
    setCardAligned(false);
    setCardCandidate(null);
    cardStableSinceRef.current = null;
  }

  /* Derived state */
  const settled = faceSetupCountdown <= 0;
  const isFaceReady = cameraStatus === "ready" && faceStatus === "ready" && faceCount === 1 && facePositionStatus === "ready";
  const noFace = faceCount === 0;
  const hint = FACE_HINTS[facePositionStatus];

  const faceBadge = !settled
    ? `Get ready${faceSetupCountdown > 0 ? ` · ${faceSetupCountdown}s` : ""}`
    : isFaceReady ? "Position confirmed" : hint ? hint[0] : "Finding your position";

  const faceMessage = !settled
    ? `Take a moment to position yourself. Starting in ${faceSetupCountdown}.`
    : isFaceReady ? "Perfect. Hold your position for a moment."
    : hint ? hint[1] : noFace ? "Center your face inside the guide." : "Finding your position...";

  const cardBadge = cardAligned ? "Card aligned" : cardStatus === "detected" ? "Card detected" : "Waiting for card";
  const cardMessage = cardAligned
    ? "Card aligned. Hold it still for a moment."
    : cardStatus === "detected" ? "Card detected. Move it into the guide box."
    : cardStatus === "loading" ? "Preparing automatic card detection..."
    : cardStatus === "error" ? "Card detection error. Reposition the card and try again."
    : "Place your card flat against the screen and align all four edges with the guide.";

  /* Tracking box over the video (snaps to guide when aligned) */
  function getCandidateStyle() {
    if (!cardCandidate || !videoRef.current) return null;
    const v = videoRef.current.getBoundingClientRect();
    const g = guideRef.current?.getBoundingClientRect();
    if (v.width <= 0 || v.height <= 0) return null;
    if (cardAligned && g) return { left: g.left - v.left, top: g.top - v.top, width: g.width, height: g.height };

    const sx = v.width / ANALYSIS_WIDTH;
    const sy = v.height / ANALYSIS_HEIGHT;
    return {
      left: (ANALYSIS_WIDTH - (cardCandidate.x + cardCandidate.width)) * sx,
      top: cardCandidate.y * sy,
      width: cardCandidate.width * sx,
      height: cardCandidate.height * sy,
    };
  }
  const candidateStyle = getCandidateStyle();

  const titles = {
    card: ["Match your card to the guide", "Hold a standard bank card flat against the screen and align its edges with the guide."],
    face: ["Take your viewing position", "Put the card down and sit as you will for the test. Center your face in the guide and hold still. This becomes your reference position."],
    complete: ["You're all set", "Your screen is calibrated and your viewing position is saved. Starting the visual-acuity test."],
  };

  const camBadge = {
    padding: "7px 12px", borderRadius: 999, background: "rgba(0,0,0,.72)", color: "#fff", fontSize: 12, fontWeight: 700,
  };
  const green = "var(--acebedo-success)";

  return (
    <section
      style={{
        width: "100%", minHeight: "calc(100vh - 80px)", background: "var(--acebedo-background)", padding: "20px",
        boxSizing: "border-box", display: "flex", alignItems: "center",
      }}
    >
      <div
        style={{
          width: "min(1240px, 100%)", margin: "0 auto", display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)", gap: 28, alignItems: "center",
        }}
      >
        {/* LEFT: camera */}
        <div
          ref={cameraContainerRef}
          style={{
            position: "relative", width: "min(100%, calc((100vh - 150px) * 16 / 9))", aspectRatio: "16 / 9",
            overflow: "hidden", borderRadius: 24, background: "var(--acebedo-camera-bg)", boxShadow: "0 24px 60px rgba(20,24,35,.14)",
          }}
        >
          <video
            ref={videoRef} muted autoPlay playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", objectFit: "cover", transform: "scaleX(-1)", background: "var(--acebedo-camera-bg)" }}
          />

          <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", pointerEvents: "none", zIndex: 5 }}>
            <div style={camBadge}>{phase === "face" ? "Viewing position" : phase === "card" ? "Screen calibration" : "Setup"}</div>
            <div style={{ ...camBadge, background: phase === "complete" || (phase === "card" && cardAligned) ? green : camBadge.background }}>
              {phase === "face" ? faceBadge : phase === "card" ? cardBadge : "Ready"}
            </div>
          </div>

          {phase === "face" && (
            <>
              <div ref={faceGuideRef} style={{ position: "absolute", left: "50%", top: "50%", width: "min(30%, 300px)", aspectRatio: "0.78 / 1", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 3 }}>
                <div style={{ position: "absolute", inset: "0 7% 7%", borderRadius: "47% 47% 42% 42% / 39% 39% 48% 48%", background: "rgba(255,255,255,.035)", boxShadow: "0 0 0 9999px rgba(0,0,0,.66)", border: isFaceReady ? "2px solid var(--acebedo-camera-ok)" : "2px solid rgba(255,255,255,.88)", transition: "border-color .25s ease" }} />
                <div style={{ position: "absolute", left: "12%", right: "12%", top: "42%", height: 1, background: isFaceReady ? "rgba(40,212,155,.9)" : "rgba(255,255,255,.65)" }} />
                <div style={{ position: "absolute", left: "50%", top: "42%", width: 18, height: 18, transform: "translate(-50%, -50%)", border: isFaceReady ? "2px solid var(--acebedo-camera-ok)" : "2px solid rgba(255,255,255,.88)", borderRadius: "50%" }} />
              </div>

              <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", maxWidth: "calc(100% - 32px)", padding: "10px 18px", borderRadius: 999, background: isFaceReady ? "rgba(19,168,117,.94)" : "rgba(0,0,0,.78)", color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "center", zIndex: 5, pointerEvents: "none" }}>
                {faceMessage}
              </div>
            </>
          )}

          {phase === "card" && (
            <>
              <div
                ref={guideRef}
                style={{
                  position: "absolute", left: "50%", top: "50%", width: "clamp(280px, 62%, 560px)",
                  aspectRatio: `${CARD_WIDTH_MM} / ${CARD_HEIGHT_MM}`, transform: "translate(-50%, -50%)",
                  border: cardAligned ? "4px solid var(--acebedo-camera-ok)" : "3px dashed rgba(255,255,255,.92)", borderRadius: 16,
                  background: "rgba(255,255,255,.04)",
                  boxShadow: cardAligned ? "0 0 0 9999px rgba(33,201,151,.4), 0 0 28px rgba(33,201,151,.4)" : "0 0 0 9999px rgba(0,0,0,.8)",
                  pointerEvents: "none", zIndex: 4, overflow: "hidden", transition: "border-color .2s ease, box-shadow .2s ease",
                }}
              >
                {[["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]].map(([v, h]) => (
                  <div key={v + h} style={{ position: "absolute", [v]: -2, [h]: -2, width: 24, height: 24, boxSizing: "border-box", zIndex: 2, [`border${cap(v)}`]: "4px solid #fff", [`border${cap(h)}`]: "4px solid #fff", [`border${cap(v)}${cap(h)}Radius`]: 16 }} />
                ))}
                <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", padding: "8px 14px", borderRadius: 999, background: cardAligned ? green : "rgba(0,0,0,.78)", color: "#fff", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", zIndex: 3 }}>
                  {cardAligned ? "Hold still" : "Align card here"}
                </div>
              </div>

              {candidateStyle && (
                <div style={{ position: "absolute", ...candidateStyle, border: cardAligned ? "3px solid var(--acebedo-camera-ok)" : "2px solid rgba(255,255,255,.85)", borderRadius: 16, pointerEvents: "none", zIndex: 3, transition: "all .15s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
              )}

              <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", width: "min(640px, calc(100% - 32px))", padding: "10px 18px", borderRadius: 999, background: cardAligned ? "rgba(19,168,117,.94)" : "rgba(0,0,0,.78)", color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "center", zIndex: 5, pointerEvents: "none" }}>
                {cardMessage}
              </div>
            </>
          )}

          {(phase === "complete" || (phase === "card" && cardStatus === "complete")) && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.48)", zIndex: 10 }}>
              <div style={{ width: "min(360px, calc(100% - 32px))", padding: 24, borderRadius: 20, background: "rgba(255,255,255,.96)", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: "50%", background: "var(--acebedo-success-bg)", color: "var(--acebedo-success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>✓</div>
                <h2 style={{ margin: "0 0 6px", color: "var(--acebedo-text)", fontFamily: "var(--font-brand)", fontSize: 24 }}>{phase === "complete" ? "Position saved" : "Screen calibrated"}</h2>
                <p style={{ margin: 0, color: "var(--acebedo-text-muted)", lineHeight: 1.5, fontSize: 14 }}>{phase === "complete" ? "Stay in this position for the test." : "Next: take your viewing position."}</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: one compact panel, no scrolling */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Substep tracker (Setup is one stage; calibration is a substep) */}
          <div>
            <div style={{ display: "flex", gap: 6 }}>
              {["card", "face"].map((p) => {
                const done = phase === "complete" || (p === "card" && phase === "face");
                const active = phase === p;
                return <div key={p} style={{ flex: 1, height: 4, borderRadius: 4, background: done || active ? "var(--acebedo-red)" : "var(--acebedo-border)" }} />;
              })}
            </div>
            <div style={{ marginTop: 8, color: "var(--acebedo-text-muted)", fontSize: 12, fontWeight: 700 }}>
              {phase === "card" ? "Setup · Step 1 of 2: Screen calibration" : "Setup · Step 2 of 2: Viewing position"}
            </div>
          </div>

          <div>
            <h1 style={{ margin: 0, color: "var(--acebedo-text)", fontFamily: "var(--font-brand)", fontSize: "clamp(26px, 2.6vw, 36px)", lineHeight: 1.1 }}>
              {titles[phase][0]}
            </h1>
            <p style={{ margin: "10px 0 0", color: "var(--acebedo-text-muted)", fontSize: 14, lineHeight: 1.6 }}>{titles[phase][1]}</p>
          </div>

          {/* Compact status rows */}
          <div style={{ display: "grid", gap: 8 }}>
            <StatusRow
              title="Camera"
              Icon={CameraIcon}
              SuccessIcon={CheckCircleIcon}
              state={cameraStatus === "ready" ? "success" : cameraStatus === "error" ? "error" : "loading"}
              text={cameraStatus === "ready" ? "Ready" : cameraStatus === "error" ? "Unavailable" : "Starting..."}
            />
            <StatusRow
              title="Screen calibration"
              Icon={CardIcon}
              SuccessIcon={CheckCircleIcon}
              state={cardStatus === "complete" ? "success" : cardStatus === "error" ? "error" : phase === "card" ? "loading" : "idle"}
              text={cardStatus === "complete" ? "Calibration complete" : cardAligned ? "Card aligned" : cardStatus === "error" ? "Detection error" : "Looking for your card..."}
            />
            <StatusRow
              title="Viewing position"
              Icon={UserIcon}
              SuccessIcon={CheckCircleIcon}
              state={phase === "complete" ? "success" : phase === "card" ? "idle" : faceStatus === "error" ? "error" : isFaceReady ? "success" : "loading"}
              text={phase === "complete" ? "Position saved" : phase === "card" ? "Starts after calibration" : faceCount > 1 ? "Multiple faces detected" : faceCount === 1 ? "Face detected" : faceStatus === "error" ? "Unavailable" : "Looking for your face..."}
            />
          </div>

          {/* Instructions */}
          <div style={{ padding: 16, borderRadius: 16, background: "var(--acebedo-surface)", border: "1px solid var(--acebedo-border)" }}>
            {phase === "face" && (
              <ol style={{ margin: 0, paddingLeft: 20, listStyle: "decimal", color: "var(--acebedo-text-muted)", fontSize: 13, lineHeight: 1.7 }}>
                <li>Put your card down and sit as you will for the test.</li>
                <li>Fit your face inside the oval.</li>
                <li>Hold still. The camera preview is hidden once the test starts.</li>
              </ol>
            )}
            {phase === "card" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ color: "var(--acebedo-text-muted)", fontSize: 13, lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--acebedo-red-hover)" }}>How to hold your card</strong>
                  <br />
                  Hold it by the <strong>left and right edges</strong>. Keep fingers off the top and bottom edges so the camera can trace its shape.
                </div>
                <HoldingAnimation />
              </div>
            )}
            {phase === "complete" && calibrationResult && (
              <div style={{ color: "var(--acebedo-text-muted)", fontSize: 13, lineHeight: 1.7 }}>
                Screen scale {calibrationResult.pixelsPerMm.toFixed(3)} px/mm · Viewing position saved. Please stay in this position during the test.
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--acebedo-error-bg)", border: "1px solid var(--acebedo-error-border)", color: "var(--acebedo-red-hover)", fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {phase === "card" && cardStatus === "error" && (
            <button type="button" onClick={retryCardDetection} style={{ minHeight: 44, border: "none", borderRadius: 12, background: "var(--acebedo-red)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Retry card detection
            </button>
          )}

          <p style={{ margin: 0, color: "var(--acebedo-text-muted)", fontSize: 11, lineHeight: 1.6 }}>
            Preliminary digital vision screening. It does not replace a comprehensive eye examination or provide a prescription. Your camera feed is processed on this device and is not stored.
          </p>
        </div>
      </div>

      {/* hidden processing canvas */}
      <canvas
        ref={processingCanvasRef} width={ANALYSIS_WIDTH} height={ANALYSIS_HEIGHT} aria-hidden="true"
        style={{ position: "fixed", width: 1, height: 1, left: -10000, top: -10000, opacity: 0, pointerEvents: "none" }}
      />
    </section>
  );
}

/* ---------- Small UI components ---------- */

function StatusRow({ title, state, text, Icon, SuccessIcon }) {
  const styles = {
    success: { color: "var(--acebedo-success)", symbol: "✓" },
    error: { color: "var(--acebedo-error)", symbol: "!" },
    loading: { color: "var(--acebedo-red)", symbol: "…" },
    idle: { color: "var(--acebedo-text-muted)", symbol: "—" },
  };

  const s = styles[state] || styles.idle;
  const DisplayIcon = state === "success" ? SuccessIcon : Icon;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 12,
        background: "var(--acebedo-surface)",
        border: "1px solid var(--acebedo-border)",
      }}
    >
      <div
        style={{
          flex: "0 0 28px",
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: s.color,
          background: "transparent",
        }}
      >
        {DisplayIcon ? (
          <DisplayIcon size={22} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <span
            style={{ color: s.color, fontWeight: 800, fontSize: 13 }}
            aria-hidden="true"
          >
            {s.symbol}
          </span>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flex: 1,
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--acebedo-text)", fontWeight: 700 }}>
          {title}
        </span>
        <span style={{ color: "var(--acebedo-text-muted)" }}>
          {text}
        </span>
      </div>
    </div>
  );
}

function HoldingAnimation() {
  return (
    <div style={{ flex: "0 0 auto" }}>
      <style>{`
        @keyframes slideLeftFinger { 0%,100% { transform: translateX(-8px); opacity: 0; } 15%,85% { transform: translateX(0); opacity: 1; } }
        @keyframes slideRightFinger { 0%,100% { transform: translateX(8px); opacity: 0; } 15%,85% { transform: translateX(0); opacity: 1; } }
      `}</style>
      <svg width="110" height="74" viewBox="0 0 150 100" fill="none" style={{ display: "block" }}>
        <rect x="25" y="20" width="100" height="60" rx="6" fill="#fff5f4" stroke="#a92e2a" strokeWidth="2" />
        <rect x="35" y="30" width="18" height="18" rx="2" fill="#ffd9d5" />
        <rect x="65" y="30" width="45" height="4" rx="2" fill="#ffd9d5" />
        <rect x="65" y="40" width="35" height="4" rx="2" fill="#ffd9d5" />
        <g style={{ animation: "slideLeftFinger 3.5s infinite ease-in-out" }}>
          <rect x="10" y="35" width="22" height="14" rx="7" fill="#fca5a5" stroke="#fff" strokeWidth="2" />
          <rect x="14" y="52" width="18" height="14" rx="7" fill="#fca5a5" stroke="#fff" strokeWidth="2" />
        </g>
        <g style={{ animation: "slideRightFinger 3.5s infinite ease-in-out" }}>
          <rect x="118" y="35" width="22" height="14" rx="7" fill="#fca5a5" stroke="#fff" strokeWidth="2" />
          <rect x="118" y="52" width="18" height="14" rx="7" fill="#fca5a5" stroke="#fff" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
