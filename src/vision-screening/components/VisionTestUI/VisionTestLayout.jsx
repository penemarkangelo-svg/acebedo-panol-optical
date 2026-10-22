import "./VisionTest.css";

export default function VisionTestLayout({
  eyebrow,
  title,
  instruction,
  status,
  assessment,
  testSurface,
  responses,
  footer,
}) {
  return (
    <div className="vision-test">
      <header className="vision-test__header">
        <div className="vision-test__header-main">
          <p className="vision-test__eyebrow">{eyebrow}</p>
          <h1 className="vision-test__title">{title}</h1>
          <p className="vision-test__instruction">{instruction}</p>
        </div>

        <div className="vision-test__status">{status}</div>
      </header>

      <div className="vision-test__header-divider" aria-hidden="true" />

      <div className="vision-test__workspace">
        <aside className="vision-test__assessment">{assessment}</aside>

        <main className="vision-test__main">
          <section className="vision-test__surface">{testSurface}</section>
        </main>

        <aside className="vision-test__responses">{responses}</aside>
      </div>

      {footer ? (
        <>
          <div className="vision-test__footer-divider" aria-hidden="true" />
          <footer className="vision-test__footer">{footer}</footer>
        </>
      ) : null}
    </div>
  );
}
