import { ACUITY } from "../constants/screeningConfig.js";
import screeningQuestions from "../data/screeningQuestions.js";
import { buildSummary } from "./interpretResults.js";

const EYES = ["right", "left"];
const DUOCHROME_ANSWERS = ["red", "same", "green"];

export function createSubmissionId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("A secure random UUID generator is not available.");
  }

  return globalThis.crypto.randomUUID();
}

function validateQuestionnaire(answers = {}) {
  const issues = [];

  for (const question of screeningQuestions) {
    const answer = answers[question.id];
    if (question.id === "eyeConditionDetails") continue;

    if (question.type === "number") {
      const age = Number(answer);
      if (
        answer === undefined || answer === null || answer === "" ||
        !Number.isInteger(age) || age < question.min || age > question.max
      ) {
        issues.push(`${question.id} is missing or invalid`);
      }
      continue;
    }

    if (question.type === "checkbox") {
      const valid = Array.isArray(answer) && answer.length > 0 &&
        answer.every((item) => question.options.includes(item)) &&
        new Set(answer).size === answer.length &&
        !(answer.includes("None of these") && answer.length > 1);
      if (!valid) issues.push(`${question.id} is missing or invalid`);
      continue;
    }

    if (question.id === "screeningAcknowledgment") {
      if (answer !== "Yes, I understand") {
        issues.push(`${question.id} must be accepted`);
      }
      continue;
    }

    if (!question.options?.includes(answer)) {
      issues.push(`${question.id} is missing or invalid`);
    }
  }

  if (
    answers.eyeCondition === "Yes" &&
    answers.eyeConditionDetails != null &&
    typeof answers.eyeConditionDetails !== "string"
  ) {
    issues.push("eyeConditionDetails is invalid");
  }

  return issues;
}

function getEyeResults(result, testName) {
  if (!result?.completedAt || !Array.isArray(result.eyes) || result.eyes.length !== EYES.length) {
    return null;
  }

  const byEye = new Map(result.eyes.map((item) => [item.eye, item]));
  if (byEye.size !== EYES.length || EYES.some((eye) => !byEye.has(eye))) {
    return null;
  }

  if (testName === "visualAcuity") {
    const complete = EYES.every((eye) => {
      const item = byEye.get(eye);
      return Array.isArray(item.trials) &&
        item.trials.length === ACUITY.trialsPerEye &&
        item.trials.every((trial, index) =>
          trial.eye === eye &&
          trial.trial === index + 1 &&
          Number.isFinite(trial.logMAR) &&
          typeof trial.correct === "boolean" &&
          typeof trial.expected === "string" &&
          typeof trial.answered === "string" &&
          typeof trial.timestamp === "string"
        ) &&
        Number.isFinite(item.estimatedLogMAR) &&
        typeof item.limitedByScreen === "boolean" &&
        Number.isInteger(item.correctResponses) &&
        item.totalResponses === ACUITY.trialsPerEye;
    });
    return complete ? byEye : null;
  }

  if (testName === "duochrome") {
    return EYES.every((eye) =>
      DUOCHROME_ANSWERS.includes(byEye.get(eye).answer) &&
      typeof byEye.get(eye).timestamp === "string"
    )
      ? byEye
      : null;
  }

  if (testName === "clockDial") {
    return EYES.every((eye) =>
      typeof byEye.get(eye).equal === "boolean" &&
      Array.isArray(byEye.get(eye).lines) &&
      byEye.get(eye).lines.every((line) => Number.isInteger(line)) &&
      typeof byEye.get(eye).timestamp === "string"
    ) ? byEye : null;
  }

  return null;
}

export function getScreeningCompletionIssues({
  questionnaireAnswers,
  visualAcuity,
  duochrome,
  clockDial,
}) {
  const issues = validateQuestionnaire(questionnaireAnswers);

  if (!getEyeResults(visualAcuity, "visualAcuity")) {
    issues.push("Visual Acuity must be complete for both eyes");
  }
  if (!getEyeResults(duochrome, "duochrome")) {
    issues.push("Duochrome must be complete for both eyes");
  }
  if (!getEyeResults(clockDial, "clockDial")) {
    issues.push("Clock Dial must be complete for both eyes");
  }

  return issues;
}

export function buildScreeningData({
  questionnaireAnswers,
  questionnaireCompletedAt,
  visualAcuity,
  duochrome,
  clockDial,
  startedAt,
  completedAt,
  submissionId,
}) {
  const issues = getScreeningCompletionIssues({
    questionnaireAnswers,
    visualAcuity,
    duochrome,
    clockDial,
  });

  if (!questionnaireCompletedAt) issues.push("Questionnaire completion time is missing");
  if (!startedAt || !completedAt) issues.push("Screening completion metadata is missing");
  if (!submissionId) issues.push("Screening submission ID is missing");
  if (issues.length) {
    throw new Error(`Cannot save an incomplete screening: ${issues.join("; ")}`);
  }

  const questionnaireResponses = screeningQuestions.map((question) => {
    let answer = questionnaireAnswers[question.id];
    if (question.id === "eyeConditionDetails") {
      answer = questionnaireAnswers.eyeCondition === "Yes" && answer
        ? answer
        : null;
    } else if (question.type === "number") {
      answer = Number(answer);
    } else if (question.type === "checkbox") {
      answer = [...answer];
    }

    return {
      questionId: question.id,
      section: question.section,
      question: question.question,
      type: question.type,
      options: question.options || null,
      answer,
    };
  });

  const summary = buildSummary({
    acuity: visualAcuity,
    duochrome,
    clockDial,
  });

  return {
    schemaVersion: 1,
    questionnaireVersion: 1,
    submissionId,
    startedAt,
    completedAt,
    questionnaire: {
      completedAt: questionnaireCompletedAt,
      responses: questionnaireResponses,
    },
    screening: {
      calibration: visualAcuity.calibration || null,
      visualAcuity,
      duochrome,
      clockDial,
    },
    summary,
  };
}

export async function persistCompletedScreening({ client, userId, screeningData }) {
  if (!userId) throw new Error("AUTH_REQUIRED");

  const answers = Object.fromEntries(
    (screeningData?.questionnaire?.responses || []).map(({ questionId, answer }) => [questionId, answer])
  );
  if (
    screeningData?.schemaVersion !== 1 ||
    !screeningData?.submissionId ||
    !screeningData?.startedAt ||
    !screeningData?.completedAt ||
    !screeningData?.questionnaire?.completedAt ||
    screeningData?.questionnaire?.responses?.length !== screeningQuestions.length ||
    !screeningData?.summary ||
    getScreeningCompletionIssues({
      questionnaireAnswers: answers,
      visualAcuity: screeningData?.screening?.visualAcuity,
      duochrome: screeningData?.screening?.duochrome,
      clockDial: screeningData?.screening?.clockDial,
    }).length > 0
  ) {
    throw new Error("INCOMPLETE_SCREENING");
  }

  const existingQuery = client
    .from("vision_screening_results")
    .select("id")
    .eq("user_id", userId)
    .eq("screening_data->>submissionId", screeningData.submissionId);
  const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id != null) return { id: existing.id, duplicate: true };

  const { data, error } = await client
    .from("vision_screening_results")
    .insert({
      user_id: userId,
      screening_data: screeningData,
      status: "completed",
    })
    .select("id")
    .single();

  if (error) throw error;
  if (data?.id == null) throw new Error("The database did not confirm the saved screening record.");

  return { id: data.id, duplicate: false };
}
