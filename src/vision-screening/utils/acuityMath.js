import { ACUITY } from "../constants/screeningConfig";

export const ARCMIN = Math.PI / (180 * 60);

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const distance = (x1, y1, x2, y2) =>
  Math.hypot(x2 - x1, y2 - y1);

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/*
 * Landolt C size for a logMAR level (ISO 8596):
 * gap = 1 arcmin x MAR at the test distance, full C = 5 x gap.
 */
export function getLandoltGeometry(
  logMAR,
  pixelsPerMm,
  distanceMm = ACUITY.testDistanceMm
) {
  const mar = 10 ** logMAR;
  const gapMm =
    2 * distanceMm * Math.tan((mar * ARCMIN) / 2);
  const diameterMm = 5 * gapMm;

  return {
    gapMm,
    diameterMm,
    gapPx: gapMm * pixelsPerMm,
    diameterPx: diameterMm * pixelsPerMm,
  };
}

/*
 * Smallest logMAR (in 0.1 steps) this screen can draw
 * with a gap of at least minGapPx.
 */
export function getMinDisplayLogMAR(
  pixelsPerMm,
  distanceMm = ACUITY.testDistanceMm
) {
  const gapMm = ACUITY.minGapPx / pixelsPerMm;
  const mar =
    gapMm / (2 * distanceMm * Math.tan(ARCMIN / 2));

  return Math.max(
    ACUITY.minLogMAR,
    Math.ceil(Math.log10(mar) * 10) / 10
  );
}