import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { formatAppointmentDate, getAppointmentReference } from "../../appointments/appointmentUtils";
import { supabase } from "../../lib/supabaseClient";

const eyes = [["right", "Right"], ["left", "Left"]];
const measurements = [
  ["sphere", "Sphere", "-999.99", "999.99", "0.01"],
  ["cylinder", "Cylinder", "-999.99", "999.99", "0.01"],
  ["axis", "Axis", "0", "180", "1"],
];

export default function CreateClinicalPrescription({ onClose, onCreated, initialVisit = null }) {
  const dialogRef = useRef(null);
  const requestId = useRef(null);
  const [reference, setReference] = useState(() => getAppointmentReference(initialVisit));
  const [patient, setPatient] = useState(initialVisit);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  async function findPatient(event) {
    event.preventDefault();
    if (busy) return;
    const match = /^AP-(\d{6})-(\d{3,10})$/i.exec(reference.trim());
    const id = match && Number(match[2]);
    if (!id || id > 2147483647) {
      setError("Enter the full appointment reference, such as AP-261124-001.");
      return;
    }
    setBusy("lookup");
    setError("");
    try {
      const { data, error: lookupError } = await supabase.rpc("get_clinic_prescription_context", {
        p_appointment_id: id, p_visit_date_key: match[1],
      });
      if (lookupError) {
        setError(lookupError.code === "PGRST202" ? "Prescription creation is currently unavailable." : "The appointment could not be checked. Try again.");
      } else if (!data || getAppointmentReference(data) !== reference.trim().toUpperCase()) {
        setError("No completed appointment for a customer account matches this reference.");
      } else {
        requestId.current = crypto.randomUUID();
        setPatient(data);
      }
    } catch {
      setError("The appointment could not be checked. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function createPrescription(event) {
    event.preventDefault();
    if (!patient || busy) return;
    const form = new FormData(event.currentTarget);
    const numeric = (key) => form.get(key) === "" ? null : Number(form.get(key));
    const values = Object.fromEntries(eyes.flatMap(([eye]) => measurements.map(([key]) => {
      const field = `${eye}_${key}`;
      return [field, numeric(field)];
    })));
    if (values.right_sphere == null && values.left_sphere == null) {
      setError("Enter the prescribed sphere for at least one eye.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const { data, error: saveError } = await supabase.rpc("create_clinic_prescription", {
        p_appointment_id: patient.id,
        p_visit_date_key: reference.trim().slice(3, 9),
        p_request_id: requestId.current,
        p_values: {
          ...values,
          pupillary_distance: numeric("pupillary_distance"),
          expires_on: form.get("expires_on") || null,
          prescription_notes: form.get("prescription_notes").trim() || null,
        },
      });
      if (saveError || !data) {
        if (saveError?.code === "22007") setError("Enter an expiry date on or after today.");
        else if (saveError?.code === "22023") setError(saveError.message);
        else if (saveError?.code === "P0002") setError("This appointment is no longer eligible. Check the appointment reference again.");
        else if (saveError?.code === "23505") setError("This request already saved a record. Close this form and check the directory.");
        else setError("The prescription could not be confirmed. Retry to check the same save.");
        return;
      }
      onCreated(data);
    } catch {
      setError("The prescription could not be confirmed. Retry to check the same save.");
    } finally {
      setBusy("");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="apo-prescription-drawer apo-clinical-record-drawer"
      aria-labelledby="apo-create-prescription-title"
      onClose={onClose}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
    >
      <header className="apo-prescription-drawer-header">
        <div>
          <p className="apo-prescription-eyebrow">Clinic-issued prescription</p>
          <h2 id="apo-create-prescription-title">Create prescription</h2>
        </div>
        <button type="button" className="apo-prescription-close" disabled={Boolean(busy)} onClick={() => dialogRef.current.close()} aria-label="Close form"><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="apo-prescription-drawer-content">
        <section className="apo-prescription-detail-section">
          <div className="apo-prescription-section-heading"><h3>Customer</h3></div>
          {patient ? (
            <div className="apo-clinical-patient">
              <div><strong>{patient.customer_name}</strong><small>{getAppointmentReference(patient)} · {formatAppointmentDate(patient.appointment_date, { weekday: undefined })}</small></div>
              <button className="apo-prescriptions-refresh" type="button" disabled={Boolean(busy)} onClick={() => { setPatient(null); setError(""); }}>Change</button>
            </div>
          ) : (
            <form className="apo-clinical-lookup" onSubmit={findPatient}>
              <label htmlFor="apo-clinic-visit">Completed appointment reference</label>
              <div>
                <input id="apo-clinic-visit" placeholder="AP-261124-001" required maxLength={20} value={reference} disabled={Boolean(busy)} onChange={(event) => { setReference(event.target.value); setError(""); }} />
                <button className="apo-prescriptions-refresh" type="submit" disabled={Boolean(busy)}><Search size={14} aria-hidden="true" /> {busy ? "Checking…" : "Find customer"}</button>
              </div>
            </form>
          )}
        </section>
        {patient && (
          <form id="apo-clinical-prescription-form" onSubmit={createPrescription}>
            <fieldset className="apo-clinical-values" disabled={Boolean(busy)}>
              <legend>Prescription values</legend>
              <table className="apo-prescriptions-table">
                <thead><tr><th scope="col">Eye</th>{measurements.map(([field, label]) => <th key={field} scope="col">{label}</th>)}</tr></thead>
                <tbody>
                  {eyes.map(([eye, label]) => (
                    <tr key={eye}>
                      <th scope="row">{label}</th>
                      {measurements.map(([key, measure, min, max, step]) => (
                        <td key={key}><input type="number" name={`${eye}_${key}`} aria-label={`${label} ${measure.toLowerCase()}`} min={min} max={max} step={step} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="apo-clinical-fields">
                <label>Pupillary distance (mm)<input type="number" name="pupillary_distance" min="0.01" max="999.99" step="0.01" /></label>
                <label>Expiry date<input type="date" name="expires_on" /></label>
              </div>
              <label>Prescription notes<textarea name="prescription_notes" rows="3" /></label>
            </fieldset>
          </form>
        )}
        {error && <p className="apo-clinical-error" role="alert">{error}</p>}
      </div>
      <footer className="apo-prescription-drawer-footer apo-clinical-footer">
        <button className="apo-prescriptions-refresh" type="button" disabled={Boolean(busy)} onClick={() => dialogRef.current.close()}>Cancel</button>
        <button className="apo-clinical-primary" type="submit" form="apo-clinical-prescription-form" disabled={!patient || Boolean(busy)}>{busy === "save" ? "Saving…" : "Save prescription"}</button>
      </footer>
    </dialog>
  );
}
