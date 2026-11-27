import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
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

const EMPTY_RECORDS = [];
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

function getFindingGroup({ title, subtitle, result, metricLabel, metricValue }) {
  if (!result?.available || !Array.isArray(result.eyes)) return null;
  const eyes = ["right", "left"].map((side) => result.eyes.find((eye) => eye?.eye === side)).filter(Boolean).map((eye) => ({
    label: eye.eye === "right" ? "Right eye" : "Left eye",
    metric: metricValue(eye),
    status: typeof eye.statusLabel === "string" ? eye.statusLabel : "",
    text: typeof eye.text === "string" && eye.text ? eye.text : "Finding details unavailable.",
  }));
  if (!eyes.length) return null;
  const notes = Array.isArray(result.notes) ? result.notes.filter((note) => typeof note === "string") : [];
  return { title, subtitle, metricLabel, eyes, notes };
}

function getFindings(summary) {
  return [
    { title: "Visual acuity", subtitle: "Preliminary visual-acuity findings", result: summary.acuity, metricLabel: "logMAR", metricValue: (eye) => Number.isFinite(eye.logMAR) ? eye.logMAR.toFixed(2) : "" },
    { title: "Red/green balance", subtitle: "Duochrome", result: summary.duochrome, metricLabel: "Finding", metricValue: (eye) => eye.balanced === true ? "Balanced" : eye.balanced === false ? "Difference noted" : "" },
    { title: "Line pattern", subtitle: "Clock dial", result: summary.clockDial, metricLabel: "Finding", metricValue: (eye) => eye.equal === true ? "Even appearance" : eye.equal === false ? "Difference noted" : "" },
  ].map(getFindingGroup).filter(Boolean);
}

function FindingGroup({ title, subtitle, metricLabel, eyes, notes }) {
  return (
    <section className="apo-screening-finding">
      <div className="apo-screening-finding-heading"><div><h4>{title}</h4><p>{subtitle}</p></div><span>{metricLabel}</span></div>
      <div className="apo-screening-eyes">
        {eyes.map((eye) => <article key={eye.label}>
          <span>{eye.label}</span>
          {eye.metric && <strong>{eye.metric}</strong>}
          {eye.status && <small className="apo-screening-finding-flag">{eye.status}</small>}
          <p>{eye.text}</p>
        </article>)}
      </div>
      {notes.length > 0 && <ul className="apo-screening-result-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    </section>
  );
}

function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.filter((item) => typeof item === "string").join(", ");
  return typeof answer === "string" || typeof answer === "number" ? String(answer) : "";
}

function getQuestionnaire(responses) {
  if (!Array.isArray(responses)) return [];
  return responses.filter((response) => typeof response?.question === "string")
    .map(({ questionId, question, answer }) => ({ questionId, question, answer: formatAnswer(answer) }))
    .filter(({ answer }) => answer.trim());
}

function QuestionnaireResponses({ responses }) {
  const answered = getQuestionnaire(responses);

  return (
    <section className="apo-screening-detail-section">
      <div className="apo-screening-section-heading"><FileSearch size={16} /><h3>Questionnaire responses</h3></div>
      {answered.length > 0 ? (
        <dl className="apo-screening-questionnaire">
          {answered.map(({ questionId, question, answer }) => (
            <div key={questionId ?? question}><dt>{question}</dt><dd>{answer}</dd></div>
          ))}
        </dl>
      ) : <p className="apo-screening-no-findings">No questionnaire responses were saved for this record.</p>}
    </section>
  );
}

function readScreeningDetails(id) {
  return supabase.from("vision_screening_results")
    .select("summary:screening_data->summary, responses:screening_data->questionnaire->responses, demo_only:screening_data->screening->calibration->demoOnly")
    .eq("id", id)
    .eq("status", "completed")
    .maybeSingle();
}

async function prepareScreeningReport(record) {
  const { data: visit, error: visitError } = await supabase.rpc("optometrist_screening_list")
    .eq("screening_id", record.result.id)
    .eq("appointment_id", record.appointment.id)
    .maybeSingle();
  if (visitError || !visit) return null;

  const { data, error } = await readScreeningDetails(record.result.id);
  if (error || !data) return null;

  const { appointment, result } = toScreeningRecord(visit);
  const findings = getFindings(data.summary || {}).map(({ title, subtitle, metricLabel, eyes, notes }) => ({
    title: metricLabel === "logMAR" ? title : subtitle,
    subtitle: metricLabel === "logMAR" ? "" : title,
    eyes: eyes.map((eye) => ({ ...eye, metric: eye.metric && metricLabel === "logMAR" ? `${eye.metric} logMAR` : eye.metric })),
    notes,
  }));

  return {
    reference: getScreeningReference(result),
    patientDetails: [
      ["Patient", appointment.customer_name || "Name unavailable"],
      ["Appointment", getAppointmentReference(appointment)],
      ["Visit date and time", `${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_time)}`],
      ["Visit status", visitLabel(appointment.status)],
      ["Screening completed", formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })],
    ],
    findings,
    questionnaire: getQuestionnaire(data.responses),
    demoOnly: data.demo_only === true,
  };
}

function ScreeningDetails({ record, clinical, onClose }) {
  const dialogRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const result = record.result;
  const summary = (clinical ? detail?.data?.summary : result.screening_data?.summary) || {};
  const findings = getFindings(summary);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!clinical) return;
    let active = true;
    readScreeningDetails(result.id).then((response) => { if (active) setDetail(response); });
    return () => { active = false; };
  }, [clinical, result.id]);

  async function downloadReport() {
    if (exporting || !clinical || !detail?.data) return;
    setExporting(true);
    setExportError("");
    try {
      const report = await prepareScreeningReport(record);
      if (!dialogRef.current?.open) return;
      if (!report) {
        setExportError("This record could not be verified. Refresh the list and try again.");
        return;
      }

      const { createScreeningReportPdf } = await import("../../vision-screening/utils/screeningReportPdf.js");
      if (!dialogRef.current?.open) return;
      const pdf = await createScreeningReportPdf(report);
      if (!dialogRef.current?.open) return;

      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vision-screening-${report.reference}.pdf`;
      dialogRef.current.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch {
      if (dialogRef.current?.open) setExportError("The PDF could not be downloaded. Try again.");
    } finally {
      if (dialogRef.current?.open) setExporting(false);
    }
  }

  function dismissOnBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const { left, top, right, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      dialogRef.current.close();
    }
  }

  return (
    <dialog ref={dialogRef} className="apo-screening-drawer" aria-labelledby="apo-screening-detail-title" onClick={dismissOnBackdrop} onClose={onClose}>
        <header className="apo-screening-drawer-header">
          <div><p className="apo-screening-eyebrow">Screening record</p><h2 id="apo-screening-detail-title">{getScreeningReference(result)}</h2><p>Completed {formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })}</p></div>
          <button type="button" className="apo-screening-close" aria-label="Close" onClick={() => dialogRef.current.close()}><X size={18} /></button>
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

          {clinical && detail?.data?.demo_only === true && (
            <div className="apo-screening-disclaimer apo-screening-demo-note"><AlertCircle size={16} /><p><strong>Demo screening</strong>This screening used the shortened demo flow.</p></div>
          )}
          {clinical && !detail && <p className="apo-screening-no-findings" role="status">Loading questionnaire responses and test findings.</p>}
          {clinical && detail && (detail.error || !detail.data) && (
            <p className="apo-screening-no-findings" role="alert">Screening details are unavailable. Close this record and refresh the list to try again.</p>
          )}
          {clinical && detail?.data && <QuestionnaireResponses responses={detail.data.responses} />}
          {(!clinical || detail?.data) && <section className="apo-screening-results-section">
            <div className="apo-screening-section-heading"><FileSearch size={16} /><h3>Findings by test</h3></div>
            {findings.map((finding) => <FindingGroup key={finding.title} {...finding} />)}
            {!findings.length && (
              <p className="apo-screening-no-findings">Detailed test findings are unavailable for this record.</p>
            )}
          </section>}

          <div className="apo-screening-disclaimer"><AlertCircle size={16} /><p><strong>A screening is not a diagnosis or prescription.</strong> These preliminary digital findings do not replace a comprehensive eye examination. {!clinical && "Only an Optometrist performs clinical review."}</p></div>
        </div>
        <footer className="apo-screening-drawer-footer">
          {exportError && <p className="apo-screening-export-error" role="alert">{exportError}</p>}
          <span><ShieldCheck size={14} /> View-only record</span>
          <div className="apo-screening-drawer-actions">
            {clinical && (
              <button className="apo-screening-download" type="button" onClick={downloadReport} disabled={!detail?.data || exporting}>
                {exporting ? <Loader2 size={15} className="is-spinning" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                {exporting ? "Preparing PDF…" : "Download PDF"}
              </button>
            )}
            <button type="button" onClick={() => dialogRef.current.close()}>Close</button>
          </div>
        </footer>
    </dialog>
  );
}

function toScreeningRecord(row) {
  return {
    appointment: {
      id: row.appointment_id,
      customer_name: row.customer_name,
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      status: row.appointment_status,
    },
    result: { id: row.screening_id, created_at: row.screening_created_at },
  };
}

async function loadOptometristRecords() {
  const { data, error } = await supabase.rpc("optometrist_screening_list");
  if (error) throw error;
  return (data || []).map(toScreeningRecord);
}

async function loadAdminRecords() {
  const { data: appointments, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, user_id, customer_name, appointment_date, appointment_time, status, screening_result_id")
    .in("status", ["confirmed", "completed"])
    .not("screening_result_id", "is", null)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(500);
  if (appointmentError) throw appointmentError;

  const linkedAppointments = appointments || [];
  const resultIds = [...new Set(linkedAppointments.map((appointment) => appointment.screening_result_id))];
  if (!resultIds.length) return [];

  const { data: screeningResults, error: resultError } = await supabase
    .from("vision_screening_results")
    .select("id, user_id, summary:screening_data->summary, status, created_at")
    .eq("status", "completed")
    .in("id", resultIds)
    .order("created_at", { ascending: false })
    .limit(500);
  if (resultError) throw resultError;

  const resultById = new Map((screeningResults || []).map((result) => [result.id, { ...result, screening_data: { summary: result.summary } }]));
  const appointmentByResult = new Map();
  linkedAppointments.forEach((appointment) => {
    const result = resultById.get(appointment.screening_result_id);
    if (!result || result.user_id !== appointment.user_id) return;
    if (!appointmentByResult.has(result.id)) appointmentByResult.set(result.id, { appointment, result });
  });
  return [...appointmentByResult.values()].sort((a, b) => new Date(b.result.created_at) - new Date(a.result.created_at));
}

export default function ScreeningRecords({ clinical = false }) {
  const [directory, setDirectory] = useState(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [visitFilter, setVisitFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const loading = directory?.revision !== revision || directory?.clinical !== clinical;
  const records = directory?.clinical === clinical ? directory.records : EMPTY_RECORDS;
  const loadError = !loading && directory.error;

  useEffect(() => {
    let active = true;
    const loadRecords = clinical ? loadOptometristRecords : loadAdminRecords;
    loadRecords().then(
      (records) => { if (active) setDirectory({ clinical, revision, records }); },
      (error) => { if (active) setDirectory({ clinical, revision, records: EMPTY_RECORDS, error }); },
    );
    return () => { active = false; };
  }, [clinical, revision]);

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
    <div className={`apo-screenings-page${clinical ? " apo-optometrist-screenings" : ""}`}>
      <header className="apo-screenings-header">
        <div><p className="apo-screenings-eyebrow">{clinical ? "Clinical workspace" : "Eye care"}</p><h1>{clinical ? "Vision screening records" : "Vision Screening Records"}</h1><p className="apo-screenings-subtitle">{clinical ? "Review questionnaire responses and preliminary test findings linked to confirmed or completed appointments." : "View preliminary screening findings linked to confirmed or completed appointments."}</p></div>
        <button className="apo-screenings-refresh" type="button" onClick={() => setRevision((current) => current + 1)} disabled={loading} aria-label="Refresh screening records">
          {loading ? <Loader2 size={15} className="is-spinning" /> : <RefreshCw size={15} />} Refresh
        </button>
      </header>

      {!clinical && <div className="apo-screenings-boundary-note"><ShieldCheck size={16} /><p>Only screening results linked to a confirmed or completed appointment are listed. Clinic Staff do not have access to screening details.</p></div>}

      <section className="apo-screenings-directory">
        <div className="apo-screenings-directory-heading"><div><h2>Eligible screening records</h2><span>{loadError ? "Unavailable" : `${filteredRecords.length} ${filteredRecords.length === 1 ? "record" : "records"}`}</span></div><span>Newest screenings first</span></div>
        <div className="apo-screenings-filters">
          <label className="apo-screenings-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, appointment, or record" aria-label="Search screening records" /></label>
          <label><span>Visit</span><select value={visitFilter} onChange={(event) => setVisitFilter(event.target.value)}>{VISIT_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="apo-screenings-table-wrap apo-admin-fit-table-wrap"><table className="apo-screenings-table apo-admin-fit-table"><thead><tr><th>Screening record</th><th>Patient</th><th>Linked appointment</th><th>Screening completed</th><th>Action</th></tr></thead>
          <tbody>{loading ? <tr><td className="apo-screenings-table-message" colSpan="5"><Loader2 size={17} className="is-spinning" /> Loading eligible screening records…</td></tr>
            : loadError ? <tr><td className="apo-screenings-table-message is-error" colSpan="5"><AlertCircle size={17} /> {clinical && loadError.code === "PGRST202" ? "Screening records setup is pending for this environment." : "Screening records could not be loaded. Refresh to try again."}</td></tr>
              : filteredRecords.length === 0 ? <tr><td className="apo-screenings-table-message" colSpan="5"><FileSearch size={18} /> {clinical && records.length === 0 ? "No completed screenings are linked to confirmed or completed appointments yet." : "No eligible screening records match these filters."}</td></tr>
                : filteredRecords.map((record) => {
                  const result = record.result;
                  return <tr key={result.id}>
                    <td><strong>{getScreeningReference(result)}</strong><small><CheckCircle2 size={12} />Completed screening</small></td>
                    <td><strong>{record.appointment.customer_name || "Name unavailable"}</strong></td>
                    <td><strong>{getAppointmentReference(record.appointment)}</strong><small><CalendarDays size={12} />{formatDate(record.appointment.appointment_date)} · {formatTime(record.appointment.appointment_time)}</small><span className={`apo-screening-visit-status is-${record.appointment.status}`}>{visitLabel(record.appointment.status)}</span></td>
                    <td>{formatDate(result.created_at, { hour: "numeric", minute: "2-digit" })}</td>
                    <td><button className="apo-screenings-view" type="button" onClick={() => setSelectedRecord(record)}>{clinical ? "View record" : "View findings"} <ArrowRight size={14} /></button></td>
                  </tr>;
                })}
          </tbody></table></div>
        {!loading && !loadError && <footer className="apo-screenings-directory-footer"><span>Showing {filteredRecords.length} of {records.length} linked screening records{records.length === 500 ? " (latest 500)" : ""}</span>{!clinical && <span>View-only · no clinical review or diagnosis</span>}</footer>}
      </section>

      {!clinical && <p className="apo-screenings-footnote"><Clock3 size={14} /> Screenings that are not linked to an appointment, or are linked only to a pending, cancelled, or no-show appointment, are not available here.</p>}
      {selectedRecord && <ScreeningDetails key={selectedRecord.result.id} record={selectedRecord} clinical={clinical} onClose={() => setSelectedRecord(null)} />}
    </div>
  );
}
