const stages = [
  "Questionnaire",
  "Setup",
  "Visual Acuity",
  "Duochrome",
  "Clock Dial",
  "Results",
];

export default function VisionProgress({
  currentStage = 0,
  skipQuestionnaire = false,
}) {
  return (
    <nav
      aria-label="Vision screening progress"
      className="w-full acebedo-vision-progress"
    >
      <ol className="acebedo-progress">
        {(skipQuestionnaire ? stages.slice(1) : stages).map((stage, index) => {
          const adjustedIndex = skipQuestionnaire ? index + 1 : index;
          const isCurrent = adjustedIndex === currentStage;
          const isComplete = adjustedIndex < currentStage;

          return (
            <li
              key={stage}
              data-step={index + 1}
              className={[
                "acebedo-progress-step",
                isComplete ? "is-complete" : "",
                isCurrent ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className="acebedo-progress-label"
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
