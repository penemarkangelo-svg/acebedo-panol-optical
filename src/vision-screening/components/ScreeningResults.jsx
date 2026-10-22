import { SESSION_KEYS } from "../constants/screeningConfig";
import { buildSummary, DISCLAIMER } from "../utils/interpretResults";
import { CalendarIcon, DocumentTextIcon, EyeIcon, InfoCircleIcon } from "@solar-icons/react/linear";

function readSessionJson(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function EyeResult({ item }) {
  return (
    <div className="vision-results__eye-cell">
      {item.statusLabel ? (
        <div className="vision-results__status">
          <span aria-hidden="true">−</span>
          <span>{item.statusLabel}</span>
        </div>
      ) : null}

      {item.logMAR !== undefined ? (
        <div className="vision-results__logmar">
          {item.logMAR.toFixed(2)}
          <small>logMAR</small>
        </div>
      ) : null}

      <p className="vision-results__eye-text">{item.text}</p>
    </div>
  );
}

function ResultSection({ title, subtitle, items, notes }) {
  const right = items.find((item) => item.eye === "right");
  const left = items.find((item) => item.eye === "left");

  return (
    <section className="vision-results__test">
      <div className="vision-results__test-row">
        <div className="vision-results__test-cell">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <div className="vision-results__eye-cell">
          {right ? <EyeResult item={right} /> : null}
        </div>

        <div className="vision-results__eye-cell">
          {left ? <EyeResult item={left} /> : null}
        </div>
      </div>

      {notes?.length ? (
        <div className="vision-results__notes">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* Props override stored results, so the page can pass them directly if it prefers. */
export default function ScreeningResults({
  acuity,
  duochrome,
  clockDial,
  onContinue,
  onRestart,
  onBookAppointment,
}) {
  const summary = buildSummary({
    acuity: acuity || readSessionJson(SESSION_KEYS.acuity),
    duochrome: duochrome || readSessionJson(SESSION_KEYS.duochrome),
    clockDial: clockDial || readSessionJson(SESSION_KEYS.clockDial),
  });

  return (
    <section className="vision-results">

      <div className="vision-results__container">
        <header className="vision-results__header">
          <p className="vision-results__eyebrow">Better vision / Results</p>
          <h1 className="vision-results__title">Your screening results</h1>
          <p className="vision-results__intro">
            A preliminary look at your vision, and what to do next.
          </p>
        </header>

        <div className="vision-results__layout">
          <main className="vision-results__results">
            <h2 className="vision-results__results-title">
              Your results, by test
              <span className="vision-results__results-meta">
                3 tests · Both eyes
              </span>
            </h2>

            <div className="vision-results__table">
              <div className="vision-results__table-head">
                <div>Screening test</div>
                <div className="vision-results__eye-heading">
                  Right eye <small>OD</small>
                </div>
                <div className="vision-results__eye-heading">
                  Left eye <small>OS</small>
                </div>
              </div>

              {summary.acuity.available && (
                <ResultSection
                  title="Visual acuity"
                  subtitle="Preliminary visual-acuity findings"
                  items={summary.acuity.eyes}
                  notes={summary.acuity.notes}
                />
              )}

              {summary.duochrome.available && (
                <ResultSection
                  title="Red/green balance"
                  subtitle="Duochrome"
                  items={summary.duochrome.eyes}
                />
              )}

              {summary.clockDial.available && (
                <ResultSection
                  title="Line pattern"
                  subtitle="Clock dial"
                  items={summary.clockDial.eyes}
                />
              )}
            </div>

            <p className="vision-results__below-note">
              These are screening findings, not a diagnosis or a prescription.
            </p>
          </main>

          <aside>
            <h2 className="vision-results__next-title">What comes next</h2>

            <div className="vision-results__recommendation">
              <p className="vision-results__recommendation-label">
                Recommendation
              </p>

              <h3 className="vision-results__recommendation-title">
                Make time for a comprehensive eye examination.
              </h3>

              <p className="vision-results__recommendation-text">
                {summary.recommendation}
              </p>

              <div className="vision-results__appointment-note">
                <DocumentTextIcon size={22} strokeWidth={1.8} aria-hidden="true" />
                <p>
                  You may share these results with your optometrist during an
                  in-person appointment.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBookAppointment || undefined}
              className="vision-results__appointment"
            >
              <CalendarIcon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>Book an appointment</span>
            </button>
          </aside>
        </div>

        <footer className="vision-results__disclaimer">
          <div className="vision-results__disclaimer-main">
            <div className="vision-results__disclaimer-label">
              <InfoCircleIcon size={15} strokeWidth={1.8} aria-hidden="true" />
              <strong>A screening, not a diagnosis</strong>
            </div>

            <div className="vision-results__disclaimer-copy">
              <p>{DISCLAIMER.split(" Viewing-position monitoring")[0].trim()}</p>
              <p>Viewing-position monitoring is an engineering prototype and has not been clinically validated.</p>
            </div>
          </div>

          <div className="vision-results__disclaimer-footer">
          </div>
        </footer>

        {onContinue && (
          <button
            type="button"
            onClick={() => onContinue(summary)}
            className="vision-results__done"
          >
            Done
          </button>
        )}
      </div>
    </section>
  );
}
