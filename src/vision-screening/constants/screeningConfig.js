/*
 * Every tunable number for the Vision Screening module lives here.
 * Change values here, not inside components.
 */

export const SESSION_KEYS = {
  calibration: "acebedoVisionCalibration",
  viewingPosition: "acebedoVisionViewingPosition",
  acuity: "acebedoVisionAcuityResult",
  duochrome: "acebedoVisionDuochromeResult",
  clockDial: "acebedoVisionClockDialResult",
};

export const MEDIAPIPE = {
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};

/* Same capture size in Setup and Acuity, so the saved face position is comparable */
export const CAMERA = { width: 640, height: 360 };

/* ISO/IEC ID-1 bank card */
export const CARD = {
  widthMm: 85.6,
  heightMm: 53.98,
};

/* Environment setup: face positioning + card calibration */
export const SETUP = {
  analysisWidth: 320,
  analysisHeight: 180,
  faceDetectionIntervalMs: 200,
  cardDetectionIntervalMs: 100,
  faceStableMs: 1200,
  positioningGraceMs: 5000,
  faceTargetMinGuideRatio: 0.42,
  faceTargetMaxGuideRatio: 1.05,
  faceCenterToleranceX: 0.22,
  faceCenterToleranceY: 0.22,
  faceMinLandmarks: 300,
  cardStableMs: 200,
  completeDelayMs: 1200,
  /* How closely the detected card must match the on-screen guide */
  cardAlignment: { center: 0.1, size: 0.14, aspect: 0.12 },
};

/* Visual acuity (Landolt C + adaptive staircase) */
export const ACUITY = {
  eyeOrder: ["right", "left"], // master copy: no "both"
  trialsPerEye: 18,
  testDistanceMm: 500, // approximate near-viewing position
  startLogMAR: 1.2, // first C is large and obvious (about 43 px at 3.78 px/mm)
  minLogMAR: -0.1,
  maxLogMAR: 1.5,
  logMarStep: 0.1,
  correctsToStepDown: 2, // consecutive correct answers before the C gets smaller
  estimateLastN: 6, // estimate = mean of the last N trial levels
  minGapPx: 2, // a gap thinner than ~2 px cannot be rendered reliably
  maxDiameterPx: 600,
};

/* Relative viewing-position monitoring (engineering prototype, not clinically validated) */
export const POSITION_MONITOR = {
  checkIntervalMs: 200,
  smoothing: 0.08,
  eyeCoveredThreshold: 0.18,
  warning: { scale: 0.25, x: 0.35, y: 0.35 },
  pause: { scale: 0.35, x: 0.45, y: 0.45 },
  resume: { scale: 0.2, x: 0.3, y: 0.3 },
  warningConfirmMs: 1500,
  pauseConfirmMs: 3000,
  faceLostMs: 1200,
  multipleFaceMs: 900,
};

/*
 * Result wording thresholds (logMAR). Placeholders: confirm with your optometrist.
 * <= acuityOkMax: within expected range; <= acuityMildMax: somewhat reduced; above: reduced.
 */
export const RESULT_THRESHOLDS = {
  acuityOkMax: 0.3,
  acuityMildMax: 0.5,
  eyeDifference: 0.2,
};