import "../styles/AccountLoading.css";

export default function AccountLoading({ message = "Preparing your account…" }) {
  return (
    <main className="account-loading" role="status" aria-live="polite">
      <div className="account-loading__content">
        <div className="account-loading__brand" aria-label="Acebedo Panol Optical">
          <span>ACEBEDO</span>
          <small>PANOL OPTICAL</small>
        </div>
        <span className="account-loading__spinner" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </main>
  );
}
