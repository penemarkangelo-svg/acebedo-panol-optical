import { useState } from "react";
import screeningQuestions from "../data/screeningQuestions";
import "./VisionTestUI/VisionTest.css";

export default function Questionnaire({
  data = {},
  updateData,
  onComplete,
}) {
  const [answers, setAnswers] = useState(data);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [hasAttemptedContinue, setHasAttemptedContinue] =
    useState(false);

  const visibleQuestions = screeningQuestions.filter((item) => {
    if (item.id === "eyeConditionDetails") {
      return answers.eyeCondition === "Yes";
    }

    return true;
  });

  /*
   * Keep the current question index valid if the visible
   * question count changes.
   */
  const safeQuestionIndex = Math.min(
    currentQuestion,
    Math.max(visibleQuestions.length - 1, 0)
  );

  const question = visibleQuestions[safeQuestionIndex];

  /*
   * Safety guard.
   */
  if (!question) {
    return null;
  }

  const answer = answers[question.id];

  const isFirstQuestion = safeQuestionIndex === 0;

  const isLastQuestion =
    safeQuestionIndex === visibleQuestions.length - 1;

  /*
   * ------------------------------------------------------------
   * VALIDATION
   * ------------------------------------------------------------
   */

  const hasAnswer = () => {
    if (!question.required) {
      return true;
    }

    if (question.type === "checkbox") {
      return (
        Array.isArray(answer) &&
        answer.length > 0
      );
    }

    return (
      answer !== undefined &&
      answer !== null &&
      answer !== ""
    );
  };

  const isAcknowledgmentAccepted = () => {
    if (question.id !== "screeningAcknowledgment") {
      return true;
    }

    return answer === "Yes, I understand";
  };

  const isValidAge = () => {
    if (question.id !== "age") {
      return true;
    }

    if (
      answer === undefined ||
      answer === null ||
      answer === ""
    ) {
      return false;
    }

    const age = Number(answer);

    return (
      Number.isInteger(age) &&
      age >= question.min &&
      age <= question.max
    );
  };

  const canContinue = () => {
    return (
      hasAnswer() &&
      isValidAge() &&
      isAcknowledgmentAccepted()
    );
  };

  /*
   * ------------------------------------------------------------
   * ANSWER HANDLING
   * ------------------------------------------------------------
   */

  const handleAnswer = (value) => {
    /*
     * Always keep the complete questionnaire object.
     */
    const nextAnswers = {
      ...answers,
      [question.id]: value,
    };

    /*
     * Update local state immediately so controlled inputs
     * remain editable.
     */
    setAnswers(nextAnswers);

    /*
     * Also update the parent with the complete data object.
     *
     * The parent currently merges this into testData.
     */
    updateData(nextAnswers);

    setHasAttemptedContinue(false);
  };

  const handleCheckboxChange = (option) => {
    const currentAnswers = Array.isArray(answer)
      ? answer
      : [];

    /*
     * "None of these" is mutually exclusive.
     */
    if (option === "None of these") {
      const nextValue = currentAnswers.includes(option)
        ? []
        : [option];

      handleAnswer(nextValue);

      return;
    }

    /*
     * If another option is selected, remove
     * "None of these".
     */
    const withoutNone = currentAnswers.filter(
      (item) => item !== "None of these"
    );

    if (withoutNone.includes(option)) {
      handleAnswer(
        withoutNone.filter(
          (item) => item !== option
        )
      );

      return;
    }

    handleAnswer([
      ...withoutNone,
      option,
    ]);
  };

  /*
   * ------------------------------------------------------------
   * NAVIGATION
   * ------------------------------------------------------------
   */

  const handleNext = () => {
    setHasAttemptedContinue(true);

    if (!canContinue()) {
      return;
    }

    if (isLastQuestion) {
      onComplete(answers);
      return;
    }

    setCurrentQuestion(
      (previous) => previous + 1
    );

    setHasAttemptedContinue(false);
  };

  const handleBack = () => {
    if (isFirstQuestion) {
      return;
    }

    setCurrentQuestion(
      (previous) => previous - 1
    );

    setHasAttemptedContinue(false);
  };

  /*
   * ------------------------------------------------------------
   * VALIDATION MESSAGE
   * ------------------------------------------------------------
   */

  const renderValidationMessage = () => {
    if (!hasAttemptedContinue) {
      return null;
    }

    if (
      question.id === "screeningAcknowledgment"
    ) {
      return (
        <p className="acebedo-error mt-3">
          You must acknowledge this information
          before continuing with the vision
          screening.
        </p>
      );
    }

    if (
      question.id === "age" &&
      !isValidAge()
    ) {
      return (
        <p className="acebedo-error mt-3">
          Please enter a valid age between{" "}
          {question.min} and {question.max}.
        </p>
      );
    }

    if (
      !hasAnswer() &&
      question.required
    ) {
      return (
        <p className="acebedo-error mt-3">
          Please provide an answer to continue.
        </p>
      );
    }

    return null;
  };

  /*
   * ------------------------------------------------------------
   * QUESTION INPUT
   * ------------------------------------------------------------
   */

  const renderQuestionInput = () => {
    switch (question.type) {
      /*
       * NUMBER
       */
      case "number":
        return (
          <input
            id={question.id}
            type="number"
            min={question.min}
            max={question.max}
            value={answer ?? ""}
            onChange={(event) =>
              handleAnswer(event.target.value)
            }
            placeholder={question.placeholder}
            aria-labelledby={`${question.id}-question`}
            className="acebedo-input"
          />
        );

      /*
       * TEXTAREA
       */
      case "textarea":
        return (
          <textarea
            id={question.id}
            value={answer ?? ""}
            onChange={(event) =>
              handleAnswer(event.target.value)
            }
            placeholder={question.placeholder}
            aria-labelledby={`${question.id}-question`}
            className="acebedo-textarea"
          />
        );

      /*
       * RADIO
       */
      case "radio":
        return (
          <div className="w-full space-y-3">
            {question.options.map((option) => {
              const selected = answer === option;

              return (
                <label
                  key={option}
                  className={[
                    "vision-test__question-choice",
                    selected ? "is-selected" : "",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={selected}
                    onChange={() =>
                      handleAnswer(option)
                    }
                    className="acebedo-radio"
                  />

                  <span>
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        );

      /*
       * CHECKBOX
       */
      case "checkbox":
        return (
          <div className="w-full space-y-3">
            {question.options.map((option) => {
              const checked =
                Array.isArray(answer) &&
                answer.includes(option);

              return (
                <label
                  key={option}
                  className={[
                    "vision-test__question-choice",
                    checked ? "is-selected" : "",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      handleCheckboxChange(option)
                    }
                    className="acebedo-checkbox"
                  />

                  <span>
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  /*
   * ------------------------------------------------------------
   * UI
   * ------------------------------------------------------------
   */

  return (
    <section className={`vision-test__questionnaire${question.id === "age" ? " is-age-question" : ""}`}>
      <header className="vision-test__questionnaire-header">
        <p className="acebedo-eyebrow">{question.section}</p>
      </header>

      <div className="vision-test__questionnaire-content">
        <h1
          id={`${question.id}-question`}
          className="acebedo-heading-sm"
        >
          {question.question}
        </h1>

        <div className="vision-test__questionnaire-input">
          {renderQuestionInput()}
        </div>

        {renderValidationMessage()}
      </div>

      {/* ======================================================
          ACTIONS
          ====================================================== */}

      <footer className="vision-test__questionnaire-actions">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstQuestion}
          className="vision-test__questionnaire-back"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="acebedo-btn acebedo-btn-primary"
        >
          {isLastQuestion
            ? "Continue to setup"
            : "Continue"}
        </button>
      </footer>
    </section>
  );
}
