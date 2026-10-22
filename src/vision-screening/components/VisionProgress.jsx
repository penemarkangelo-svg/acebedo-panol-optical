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
}) {
  return (
    <nav
      aria-label="Vision screening progress"
      className="w-full"
    >
      <ol className="acebedo-progress">
        {stages.map((stage, index) => {
          const isCurrent = index === currentStage;
          const isComplete = index < currentStage;

          return (
            <li
              key={stage}
              data-step={index + 1}
              className={[
                "acebedo-progress-step",
                isComplete
                  ? "is-complete"
                  : "",
                isCurrent
                  ? "is-current"
                  : "",
              ].join(" ")}
              aria-current={
                isCurrent ? "step" : undefined
              }
            >
              <span
                className={[
                  "text-xs leading-tight",
                  "hidden sm:block",
                  isCurrent
                    ? "font-semibold text-[var(--acebedo-text)]"
                    : isComplete
                      ? "text-[var(--acebedo-text)]"
                      : "text-[var(--acebedo-text-muted)]",
                ].join(" ")}
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