import { useId, useRef, useState } from "react";
import { Check, File, Lock, X } from "lucide-react";
import { PRESCRIPTION_FILE_LIMIT, PRESCRIPTION_FILE_TYPES } from "../lib/orderPrescriptionUploads";
import "../styles/PrescriptionUploadGuide.css";

function formatFileSize(size) {
  if (size >= 1024 * 1024) return `${Number((size / (1024 * 1024)).toFixed(1))} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export default function PrescriptionUploadModal({ dialogRef, title, confirmLabel, onConfirm }) {
  const id = useId();
  const fileInput = useRef(null);
  const submitting = useRef(false);
  const [selection, setSelection] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function clearSelection() {
    setSelection(null);
    setConfirmed(false);
    setError("");
  }

  function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearSelection();

    const extension = PRESCRIPTION_FILE_TYPES.get(file.type);
    if (!extension || file.size === 0 || file.size > PRESCRIPTION_FILE_LIMIT) {
      setError("Choose a non-empty PDF, JPG, or PNG file up to 5 MB.");
      return;
    }
    setSelection({ file, extension, fileId: crypto.randomUUID() });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selection || !confirmed || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await onConfirm(selection);
      dialogRef.current?.close();
    } catch {
      setError("The file could not be submitted. Try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="apo-rx-upload-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => { if (submitting.current) event.preventDefault(); }}
      onClose={clearSelection}
    >
      <form onSubmit={handleSubmit} aria-busy={saving}>
        <header className="apo-rx-upload-header">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="apo-rx-upload-close" aria-label="Close prescription upload" disabled={saving} onClick={() => dialogRef.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
          <p id={`${id}-description`}>We review it before processing your order.</p>
        </header>
        <div className={`apo-rx-upload-picker${selection ? " has-file" : ""}`}>
          <input ref={fileInput} type="file" accept={Array.from(PRESCRIPTION_FILE_TYPES.keys()).join(",")} onChange={chooseFile} hidden />
          <span className="apo-rx-upload-file-icon"><File size={21} aria-hidden="true" /></span>
          <div className="apo-rx-upload-file-details" role="status">
            <strong>{selection ? selection.file.name : "Choose a prescription file"}</strong>
            <span id={`${id}-format`}>
              {selection ? `${formatFileSize(selection.file.size)} · Ready to upload` : "PDF, JPG, or PNG up to 5 MB"}
            </span>
          </div>
          <button type="button" aria-describedby={`${id}-format`} disabled={saving} onClick={() => fileInput.current?.click()}>
            {selection ? "Replace" : "Browse"}
          </button>
        </div>
        {error && <p className="apo-rx-upload-error" role="alert">{error}</p>}
        {selection && (
          <label className="apo-rx-upload-confirmation">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={saving} />
            <span>I checked that the full prescription, including my name, measurements, and date issued, is readable.</span>
          </label>
        )}
        <section className="apo-rx-upload-requirements" aria-labelledby={`${id}-requirements`}>
          <h3 id={`${id}-requirements`}>Make sure the file shows</h3>
          <ul>
            <li><Check aria-hidden="true" /> Your full name</li>
            <li><Check aria-hidden="true" /> Lens measurements</li>
            <li><Check aria-hidden="true" /> <strong>Date issued</strong></li>
            <li><Check aria-hidden="true" /> Valid-until date, if printed</li>
          </ul>
        </section>
        <p className="apo-rx-upload-privacy">
          <Lock size={16} aria-hidden="true" />
          <span>Stored privately. Only authorized clinic team members can view it to process this order.</span>
        </p>
        <div className="apo-rx-upload-actions">
          <button type="button" disabled={saving} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="submit" disabled={saving || !selection || !confirmed}>{saving ? "Submitting…" : confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
