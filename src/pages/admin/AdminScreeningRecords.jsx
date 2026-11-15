import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { getAppointmentReference, getScreeningReference } from "../../appointments/appointmentUtils";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminScreeningRecords.css";

const VISIT_FILTERS = [
  ["all", "All eligible visits"],
  ["confirmed", "Confirmed visits"],
  ["completed", "Completed visits"],
];

function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", ...options }).format(date);
}

function formatTime(value) {
  if (!value) return "—";
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(date);
}

function visitLabel(status) {
  return status === "completed" ? "Completed" : status === "confirmed" ? "Confirmed" : status || "Unavailable";
}

function FindingGroup({ title, subtitle, result, metricLabel, metricValue }) {
  if (!result?.available) return null;
  const right = result.eyes?.find((eye) => eye.eye === "right");
  const left = result.eyes?.find((eye) => eye.eye === "left");
  if (!right && !left) return null;

  return (
    <section className="apo-screening-finding">
      <div className="apo-screening-finding-heading"><div><h4>{title}</h4><p>{subtitle}</p></div><span>{metricLabel}</span></div>
      <div className="apo-screening-eyes">
        {[right, left].map((eye) => eye ? <article key={eye.eye}>
          <span>{eye.eye === "right" ? "Right eye" : "Left eye"}</span>
          {metricValue(eye) && <strong>{metricValue(eye)}</strong>}
          {eye.statusLabel && <small className="apo-screening-finding-flag">{eye.statusLabel}</small>}
          <p>{eye.text || "Finding details unavailable."}</p>
        </article> : null)}
      </div>
      {result.notes?.length > 0 && <ul className="apo-screening-result-notes">{result.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    </section>
  );
}

function ScreeningDetails({ record, onClose }) {
  const result = record.result;
  const summary = result.screening_data?.summary || {};

  return (
    <div className="apo-screening-overlay" role="presentation">
      <button className="apo-screening-backdrop" type="button" aria-label="Close screening record" onClick={onClose} />
      <aside className="apo-screening-drawer" role="dialog" aria-modal="true" aria-labelledby="apo-screening-detail-title">
        <header className="apo-screening-drawer-header">
          <div><p className="apo-screening-eyebrow">Screening record</p><h2 id="apo-screening-detail-title">{getScreeningReference(result)}</h2><p>Completed {formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })}</p></div>
          <button type="button" className="apo-screening-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="apo-screening-drawer-content">
          <section className="apo-screening-detail-section">
            <div className="apo-screening-section-heading"><Eye size={16} /><h3>Patient and appointment</h3></div>
            <dl className="apo-screening-detail-grid">
              <div><dt>Patient</dt><dd>{record.appointment.customer_name || "Name unavailable"}</dd></div>
              <div><dt>Appointment</dt><dd>{getAppointmentReference(record.appointment)}</dd></div>
              <div><dt>Visit date</dt><dd>{formatDate(record.appointment.appointment_date)}</dd></div>
              <div><dt>Visit time</dt><dd>{formatTime(record.appointment.appointment_time)}</dd></div>
              <div><dt>Visit status</dt><dd><span className={`apo-screening-visit-status is-${record.appointment.status}`}>{visitLabel(record.appointment.status)}</span></dd></div>
              <div><dt>Screening date</dt><dd>{formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })}</dd></div>
            </dl>
          </section>

          <section className="apo-screening-results-section">
            <div className="apo-screening-section-heading"><FileSearch size={16} /><h3>Findings by test</h3></div>
            <FindingGroup title="Visual acuity" subtitle="Preliminary visual-acuity findings" result={summary.acuity} metricLabel="logMAR" metricValue={(eye) => Number.isFinite(eye.logMAR) ? eye.logMAR.toFixed(2) : ""} />
            <FindingGroup title="Red/green balance" subtitle="Duochrome" result={summary.duochrome} metricLabel="Finding" metricValue={(eye) => eye.balanced === true ? "Balanced" : eye.balanced === false ? "Difference noted" : ""} />
            <FindingGroup title="Line pattern" subtitle="Clock dial" result={summary.clockDial} metricLabel="Finding" metricValue={(eye) => eye.equal === true ? "Even appearance" : eye.equal === false ? "Difference noted" : ""} />
            {!summary.acuity?.available && !summary.duochrome?.available && !summary.clockDial?.available && (
              <p className="apo-screening-no-findings">Detailed test findings are unavailable for this record.</p>
            )}
          </section>

          <div className="apo-screening-disclaimer"><AlertCircle size={16} /><p><strong>A screening is not a diagnosis or prescription.</strong> These preliminary digital findings do not replace a comprehensive eye examination. Only an Optometrist performs clinical review.</p></div>
        </div>
        <footer className="apo-screening-drawer-footer"><span><ShieldCheck size={14} /> View-only record</span><button type="button" onClick={onClose}>Close</button></footer>
      </aside>
    </div>
  );
}

export default function AdminScreeningRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [visitFilter, setVisitFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data: appointments, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, user_id, customer_name, appointment_date, appointment_time, status, screening_result_id")
      .in("status", ["confirmed", "completed"])
      .not("screening_result_id", "is", null)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false })
      .limit(500);

    if (appointmentError) {
      console.error("Could not load linked screening appointments:", appointmentError);
      setRecords([]);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const linkedAppointments = appointments || [];
    const resultIds = [...new Set(linkedAppointments.map((appointment) => appointment.screening_result_id))];
    if (!resultIds.length) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const { data: screeningResults, error: resultError } = await supabase
      .from("vision_screening_results")
      .select("id, user_id, summary:screening_data->summary, status, created_at")
      .eq("status", "completed")
      .in("id", resultIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (resultError) {
      console.error("Could not load eligible screening records:", resultError);
      setRecords([]);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const resultById = new Map((screeningResults || []).map((result) => [result.id, { ...result, screening_data: { summary: result.summary } }]));
    const appointmentByResult = new Map();
    linkedAppointments.forEach((appointment) => {
      const result = resultById.get(appointment.screening_result_id);
      if (!result || result.user_id !== appointment.user_id) return;
      if (!appointmentByResult.has(result.id)) appointmentByResult.set(result.id, { appointment, result });
    });
    setRecords([...appointmentByResult.values()].sort((a, b) => new Date(b.result.created_at) - new Date(a.result.created_at)));
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const filteredRecords = useMemo(() => records.filter(({ appointment, result }) => {
    const query = search.trim().toLowerCase();
    const ref = getScreeningReference(result);
    const matchesSearch = !query || [
      ref,
      getAppointmentReference(appointment),
      appointment.customer_name,
      appointment.appointment_date,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesVisit = visitFilter === "all" || appointment.status === visitFilter;
    return matchesSearch && matchesVisit;
  }), [records, search, visitFilter]);

  return (
    <div className="apo-screenings-page">
      <header className="apo-screenings-header">
        <div><p className="apo-screenings-eyebrow">Eye care</p><h1>Vision Screening Records</h1><p className="apo-screenings-subtitle">View preliminary screening findings linked to confirmed or completed appointments.</p></div>
        <button className="apo-screenings-refresh" type="button" onClick={loadRecords} disabled={loading} aria-label="Refresh screening records">
          {loading ? <Loader2 size={15} className="is-spinning" /> : <RefreshCw size={15} />} Refresh
        </button>
      </header>

      <div className="apo-screenings-boundary-note"><ShieldCheck size={16} /><p>Only screening results linked to a confirmed or completed appointment are listed. Clinic Staff do not have access to screening details.</p></div>

      <section className="apo-screenings-directory">
        <div className="apo-screenings-directory-heading"><div><h2>Eligible screening records</h2><span>{loadError ? "Unavailable" : `${filteredRecords.length} ${filteredRecords.length === 1 ? "record" : "records"}`}</span></div><span>Newest screenings first</span></div>
        <div className="apo-screenings-filters">
          <label className="apo-screenings-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, appointment, or record" aria-label="Search screening records" /></label>
          <label><span>Visit</span><select value={visitFilter} onChange={(event) => setVisitFilter(event.target.value)}>{VISIT_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="apo-screenings-table-wrap apo-admin-fit-table-wrap"><table className="apo-screenings-table apo-admin-fit-table"><thead><tr><th>Screening record</th><th>Patient</th><th>Linked appointment</th><th>Screening completed</th><th>Action</th></tr></thead>
          <tbody>{loading ? <tr><td className="apo-screenings-table-message" colSpan="5"><Loader2 size={17} className="is-spinning" /> Loading eligible screening records…</td></tr>
            : loadError ? <tr><td className="apo-screenings-table-message is-error" colSpan="5"><AlertCircle size={17} /> Screening records could not be loaded. Refresh to try again.</td></tr>
              : filteredRecords.length === 0 ? <tr><td className="apo-screenings-table-message" colSpan="5"><FileSearch size={18} /> No eligible screening records match these filters.</td></tr>
                : filteredRecords.map((record) => {
                  const result = record.result;
                  return <tr key={result.id}>
                    <td><strong>{getScreeningReference(result)}</strong><small><CheckCircle2 size={12} />Completed screening</small></td>
                    <td><strong>{record.appointment.customer_name || "Name unavailable"}</strong></td>
                    <td><strong>{getAppointmentReference(record.appointment)}</strong><small><CalendarDays size={12} />{formatDate(record.appointment.appointment_date)} · {formatTime(record.appointment.appointment_time)}</small><span className={`apo-screening-visit-status is-${record.appointment.status}`}>{visitLabel(record.appointment.status)}</span></td>
                    <td>{formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })}</td>
                    <td><button className="apo-screenings-view" type="button" onClick={() => setSelectedRecord(record)}>View findings <ArrowRight size={14} /></button></td>
                  </tr>;
                })}
          </tbody></table></div>
        <footer className="apo-screenings-directory-footer"><span>Showing {filteredRecords.length} of {records.length} linked screening records{records.length === 500 ? " (latest 500)" : ""}</span><span>View-only · no clinical review or diagnosis</span></footer>
      </section>

      <p className="apo-screenings-footnote"><Clock3 size={14} /> Screenings that are not linked to an appointment, or are linked only to a pending, cancelled, or no-show appointment, are not available here.</p>
      {selectedRecord && <ScreeningDetails record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </div>
  );
}
