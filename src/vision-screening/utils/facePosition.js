import { POSITION_MONITOR } from "../constants/screeningConfig";
import { distance } from "./acuityMath";

/*
 * Relative (not absolute) face measurements, compared against later frames.
 * We do not claim an exact physical distance.
 */
export function getRelativeFaceMetrics(landmarks) {
  if (!landmarks || landmarks.length < 264) return null;

  const a = landmarks[33];
  const b = landmarks[263];

  if (!a || !b) return null;

  const eyeDistance = distance(a.x, a.y, b.x, b.y);

  if (!Number.isFinite(eyeDistance) || eyeDistance <= 0) return null;

  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    eyeDistance,
    faceWidth: maxX - minX,
    faceHeight: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function smoothMetrics(prev, next) {
  if (!prev) return next;

  const k = POSITION_MONITOR.smoothing;
  const out = {};

  for (const key of [
    "eyeDistance",
    "faceWidth",
    "faceHeight",
    "centerX",
    "centerY",
  ]) {
    out[key] = prev[key] * (1 - k) + next[key] * k;
  }

  if (prev.blink) out.blink = prev.blink;

  return out;
}

export function getMovementMessage({
  scaleExceeded,
  xExceeded,
  yExceeded,
  scaleRatio,
}) {
  if (scaleExceeded) {
    return scaleRatio > 1
      ? "You are leaning too close to the screen. Please sit back."
      : "You are leaning too far from the screen. Please move closer.";
  }

  if (xExceeded || yExceeded) {
    return "You have moved mostly out of the camera view. Please center yourself.";
  }

  return "Please return to your original viewing distance.";
}