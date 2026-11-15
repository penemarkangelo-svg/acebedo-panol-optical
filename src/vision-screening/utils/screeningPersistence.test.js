import assert from "node:assert/strict";
import test from "node:test";
import screeningQuestions from "../data/screeningQuestions.js";
import {
  buildScreeningData,
  getScreeningCompletionIssues,
  persistCompletedScreening,
} from "./screeningPersistence.js";

const questionnaireAnswers = Object.fromEntries(
  screeningQuestions.map((question) => [
    question.id,
    question.id === "age" ? "32" :
      question.id === "visionConcern" ? "Routine vision check" :
        question.id === "distanceVision" || question.id === "nearVision" ? "Clear" :
          question.id === "eyeSymptoms" ? ["None of these"] :
            question.id === "currentGlasses" ? "No corrective eyewear" :
              question.id === "lastEyeExam" ? "I don't remember" :
                question.id === "eyeCondition" || question.id === "eyeSurgery" ||
                question.id === "healthConditions" || question.id === "medications" ? "No" :
                  question.id === "screenTime" ? "2–4 hours" :
                    question.id === "workEnvironment" ? "Mostly indoors" :
                      question.id === "screeningAcknowledgment" ? "Yes, I understand" : null,
  ])
);

const visualAcuity = {
  completedAt: "2026-11-03T00:01:00.000Z",
  calibration: { pixelsPerMm: 3.2, cardWidthMm: 85.6 },
  eyes: ["right", "left"].map((eye) => ({
    eye,
    trials: Array.from({ length: 15 }, (_, index) => ({
      eye,
      trial: index + 1,
      logMAR: 0.3,
      correct: true,
      expected: "up",
      answered: "up",
      timestamp: "2026-11-03T00:00:00.000Z",
    })),
    estimatedLogMAR: 0.3,
    limitedByScreen: false,
    correctResponses: 18,
    totalResponses: 15,
  })),
};

const duochrome = {
  completedAt: "2026-11-03T00:02:00.000Z",
  eyes: ["right", "left"].map((eye) => ({ eye, answer: "same", timestamp: "2026-11-03T00:02:00.000Z" })),
};

const clockDial = {
  completedAt: "2026-11-03T00:03:00.000Z",
  eyes: ["right", "left"].map((eye) => ({ eye, equal: true, lines: [], timestamp: "2026-11-03T00:03:00.000Z" })),
};

function buildValidPayload(overrides = {}) {
  return buildScreeningData({
    questionnaireAnswers,
    questionnaireCompletedAt: "2026-11-03T00:00:00.000Z",
    visualAcuity,
    duochrome,
    clockDial,
    startedAt: "2026-11-03T00:00:00.000Z",
    completedAt: "2026-11-03T00:04:00.000Z",
    submissionId: "screening-run-1",
    ...overrides,
  });
}

function createMockClient({ insertError = null } = {}) {
  const rows = [];
  let insertCount = 0;

  return {
    rows,
    get insertCount() { return insertCount; },
    from(table) {
      assert.equal(table, "vision_screening_results");
      let filters = {};
      let insertRecord = null;
      const query = {
        select() { return query; },
        eq(column, value) { filters[column] = value; return query; },
        async maybeSingle() {
          const found = rows.find((row) =>
            row.user_id === filters.user_id &&
            row.screening_data.submissionId === filters["screening_data->>submissionId"]
          );
          return { data: found ? { id: found.id } : null, error: null };
        },
        insert(record) {
          insertCount += 1;
          insertRecord = record;
          return query;
        },
        async single() {
          if (insertError) return { data: null, error: insertError };
          const row = { id: rows.length + 1, ...insertRecord };
          rows.push(row);
          return { data: { id: row.id }, error: null };
        },
      };
      return query;
    },
  };
}

test("builds a versioned payload with all 15 question snapshots and all three tests", () => {
  const payload = buildValidPayload();

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.questionnaire.responses.length, 15);
  assert.deepEqual(
    payload.questionnaire.responses.map((response) => response.questionId),
    screeningQuestions.map((question) => question.id)
  );
  assert.equal(payload.questionnaire.responses.find((item) => item.questionId === "age").answer, 32);
  assert.equal(payload.screening.visualAcuity.eyes.length, 2);
  assert.equal(payload.screening.duochrome.eyes.length, 2);
  assert.equal(payload.screening.clockDial.eyes.length, 2);
  assert.equal(payload.summary.acuity.available, true);
});

test("rejects incomplete questionnaire or tests before persistence", async () => {
  const incompleteAnswers = { ...questionnaireAnswers, screeningAcknowledgment: "No" };
  const incompletePayload = buildValidPayload();
  incompletePayload.questionnaire.responses.find(
    (response) => response.questionId === "screeningAcknowledgment"
  ).answer = incompleteAnswers.screeningAcknowledgment;
  const client = createMockClient();

  assert.ok(getScreeningCompletionIssues({
    questionnaireAnswers: incompleteAnswers,
    visualAcuity,
    duochrome,
    clockDial,
  }).length > 0);

  await assert.rejects(
    persistCompletedScreening({ client, userId: "user-1", screeningData: incompletePayload }),
    /INCOMPLETE_SCREENING/
  );
  assert.equal(client.insertCount, 0);
  assert.equal(client.rows.length, 0);

  const missingEyePayload = buildValidPayload();
  missingEyePayload.screening.duochrome = {
    ...missingEyePayload.screening.duochrome,
    eyes: [duochrome.eyes[0]],
  };
  await assert.rejects(
    persistCompletedScreening({ client, userId: "user-1", screeningData: missingEyePayload }),
    /INCOMPLETE_SCREENING/
  );
  assert.equal(client.insertCount, 0);
});

test("inserts once and treats a repeated submission ID as already saved", async () => {
  const client = createMockClient();
  const screeningData = buildValidPayload();

  const first = await persistCompletedScreening({ client, userId: "user-1", screeningData });
  const second = await persistCompletedScreening({ client, userId: "user-1", screeningData });

  assert.deepEqual(first, { id: 1, duplicate: false });
  assert.deepEqual(second, { id: 1, duplicate: true });
  assert.equal(client.insertCount, 1);
  assert.equal(client.rows.length, 1);
  assert.equal(client.rows[0].status, "completed");
  assert.equal(client.rows[0].user_id, "user-1");
});

test("requires an authenticated user and propagates database insert errors", async () => {
  const screeningData = buildValidPayload();
  const client = createMockClient();

  await assert.rejects(
    persistCompletedScreening({ client, userId: null, screeningData }),
    /AUTH_REQUIRED/
  );
  assert.equal(client.insertCount, 0);

  const failingClient = createMockClient({ insertError: new Error("database unavailable") });
  await assert.rejects(
    persistCompletedScreening({ client: failingClient, userId: "user-1", screeningData }),
    /database unavailable/
  );
  assert.equal(failingClient.insertCount, 1);
  assert.equal(failingClient.rows.length, 0);
});
