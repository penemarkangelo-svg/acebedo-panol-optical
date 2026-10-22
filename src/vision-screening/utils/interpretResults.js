import { RESULT_THRESHOLDS } from "../constants/screeningConfig";

/*
 * All result wording lives here so no component can say
 * "You have myopia" or "Your prescription is -2.00".
 * Thresholds come from constants/screeningConfig.js (placeholders: confirm with your optometrist).
 */

export const RECOMMENDATION =
  "The screening results suggest that you may benefit from a comprehensive eye examination.";

export const DISCLAIMER =
  "This is a preliminary digital screening. It does not diagnose eye conditions, provide a prescription, or replace a comprehensive eye examination. Viewing-position monitoring is an engineering prototype and has not been clinically validated.";

const EYE_LABEL = { right: "Right eye", left: "Left eye" };

export const eyeLabel = (eye) => EYE_LABEL[eye] || eye;

/* ---------- Visual acuity ---------- */

export function interpretAcuity(acuity) {
  if (!acuity?.eyes?.length) {
    return {
      available: false,
      eyes: [],
      flagged: false,
      notes: [],
    };
  }

  const eyes = acuity.eyes.map((e) => {
    const v = e.estimatedLogMAR;
    let text;
    let flagged = false;

    if (e.limitedByScreen) {
      text =
        "You read down to the smallest size this screen can show. Finer detail could not be tested here.";
    } else if (v <= RESULT_THRESHOLDS.acuityOkMax) {
      text =
        "Responses were within the range expected for this screening.";
    } else if (v <= RESULT_THRESHOLDS.acuityMildMax) {
      text =
        "Responses suggest somewhat reduced clarity at this test distance.";
      flagged = true;
    } else {
      text =
        "Responses suggest reduced clarity at this test distance.";
      flagged = true;
    }

    return {
      eye: e.eye,
      label: eyeLabel(e.eye),
      logMAR: v,
      text,
      flagged,
      limited: !!e.limitedByScreen,
    };
  });

  const notes = [];

  const [r, l] = [
    eyes.find((e) => e.eye === "right"),
    eyes.find((e) => e.eye === "left"),
  ];

  if (
    r &&
    l &&
    !r.limited &&
    !l.limited &&
    Math.abs(r.logMAR - l.logMAR) >= RESULT_THRESHOLDS.eyeDifference
  ) {
    notes.push("There was a noticeable difference between your two eyes.");
  }

  if (eyes.some((e) => e.limited)) {
    notes.push(
      "This screen could not display the finest letter sizes, so a clinical test is needed to measure your full acuity."
    );
  }

  return {
    available: true,
    eyes,
    flagged:
      eyes.some((e) => e.flagged) ||
      notes.some((n) => n.includes("difference")),
    notes,
  };
}

/* ---------- Duochrome: no prescription value is ever produced ---------- */

export function interpretDuochrome(duochrome) {
  if (!duochrome?.eyes?.length) {
    return {
      available: false,
      flagged: false,
      eyes: [],
    };
  }

  const eyes = duochrome.eyes.map((e) => {
    const balanced = e.answer === "same";

    return {
      eye: e.eye,
      label: eyeLabel(e.eye),
      balanced,

      // Used by the Results UI as the small warning/status label.
      statusLabel: balanced ? "" : "Unequal clarity",

      text: balanced
        ? "Red and green sides looked equally clear."
        : "Red and green sides did not look equally clear.",
    };
  });

  return {
    available: true,
    flagged: eyes.some((e) => !e.balanced),
    eyes,
  };
}

/* ---------- Clock dial: pattern only, never cylinder or axis ---------- */

export function interpretClockDial(clockDial) {
  if (!clockDial?.eyes?.length) {
    return {
      available: false,
      flagged: false,
      eyes: [],
    };
  }

  const eyes = clockDial.eyes.map((e) => ({
    eye: e.eye,
    label: eyeLabel(e.eye),
    equal: e.equal,

    // Used by the Results UI as the small warning/status label.
    statusLabel: e.equal ? "" : "Unequal line appearance",

    text: e.equal
      ? "All lines looked equally dark and sharp."
      : "Some lines looked darker or sharper than others. This can be a possible astigmatic pattern that needs a professional examination.",
  }));

  return {
    available: true,
    flagged: eyes.some((e) => !e.equal),
    eyes,
  };
}

/* ---------- Overall summary ---------- */

export function buildSummary({
  acuity,
  duochrome,
  clockDial,
}) {
  const a = interpretAcuity(acuity);
  const d = interpretDuochrome(duochrome);
  const c = interpretClockDial(clockDial);

  const flagged = a.flagged || d.flagged || c.flagged;

  return {
    acuity: a,
    duochrome: d,
    clockDial: c,
    flagged,

    headline: flagged
      ? "Some results may be worth checking"
      : "No clear concern was flagged",

    interpretation: flagged
      ? "One or more parts of this screening showed responses that may point to a possible refractive or vision concern."
      : "Your responses did not clearly point to a concern. A screening cannot rule out eye conditions, and regular comprehensive eye examinations are still advised.",

    recommendation: RECOMMENDATION,
  };
}