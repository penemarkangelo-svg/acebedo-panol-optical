import { ACUITY } from "../constants/screeningConfig";
import { clamp } from "./acuityMath";

/*
 * Next logMAR level. Two correct in a row = smaller C (lower logMAR);
 * any wrong answer (including "I can't see it") = larger C.
 */
export function nextLogMAR(
  current,
  correctStreak,
  wasCorrect,
  minLogMAR = ACUITY.minLogMAR
) {
  let next = current;

  if (
    wasCorrect &&
    correctStreak >= ACUITY.correctsToStepDown
  ) {
    next = current - ACUITY.logMarStep;
  } else if (!wasCorrect) {
    next = current + ACUITY.logMarStep;
  }

  return clamp(
    Number(next.toFixed(2)),
    minLogMAR,
    ACUITY.maxLogMAR
  );
}

/*
 * Preliminary estimate = mean of the last N trial levels for one eye.
 */
export function estimateLogMAR(trials, fallback) {
  const levels = trials
    .map((t) => t.logMAR)
    .filter(Number.isFinite)
    .slice(-ACUITY.estimateLastN);

  return levels.length
    ? levels.reduce((sum, v) => sum + v, 0) / levels.length
    : fallback;
}