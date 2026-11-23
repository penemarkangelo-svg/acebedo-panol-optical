import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Loader2, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import CreateClinicalPrescription from "./CreateClinicalPrescription";
import "../../styles/AdminPrescriptionDocuments.css";

const PAGE_SIZE = 25;
const PDF_LIMIT = 5 * 1024 * 1024;
const BUCKET = "prescription-uploads";
const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const releaseLabels = { pending_review: "Pending review", released: "Released", rejected: "Rejected" };
const formatDate = (value) => value ? dateFormatter.format(new Date(value)) : "—";
const recordReference = (id) => `RX-${id}`;

function ClinicalRecordDetails({ record, onClose }) {
  const { user } = useAuth();
  const dialogRef = useRef(null);
  const [details, setDetails] = useState(null);
  const [files, setFiles] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileAction, setFileAction] = useState("");
  const [fileError, setFileError] = useState("");
  const [notice, setNotice] = useState("");
  const [releaseFile, setReleaseFile] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      const [values, context] = await Promise.allSettled([
        supabase.from("prescription_records")
          .select("right_sphere, right_cylinder, right_axis, left_sphere, left_cylinder, left_axis, pupillary_distance, prescription_notes")
          .eq("id", record.id).maybeSingle(),
        supabase.rpc("get_clinic_prescription_context", { p_record_id: record.id }),
      ]);
      if (!active) return;
      if (values.status === "fulfilled" && !values.value.error) setDetails(values.value.data);
      if (context.status === "fulfilled" && !context.value.error && context.value.data) {
        setFiles(context.value.data.documents);
        setRecipient(context.value.data.customer_name);
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from("prescription_documents")
          .select("id, original_filename, storage_path, mime_type, release_status")
          .eq("prescription_record_id", record.id).order("created_at", { ascending: false });
        if (active && !error) setFiles(data || []);
      } catch {
        if (active) setFiles(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDetails();
    return () => { active = false; };
  }, [record.id]);

  async function openPreview(file) {
    setPreview({ file, loading: true });
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 300);
      if (error || !data?.signedUrl) throw error || new Error("Missing preview link");
      setPreview({ file, url: data.signedUrl });
    } catch {
      setPreview({ file, error: true });
    }
  }

  async function refreshDocuments() {
    const { data, error } = await supabase.rpc("get_clinic_prescription_context", { p_record_id: record.id });
    if (error || !data) throw new Error("Document status is unavailable");
    setRecipient(data.customer_name);
    setFiles(data.documents);
    return data.documents;
  }

  async function attachPdf(event) {
    event.preventDefault();
    if (fileAction || !user?.id || !recipient) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("prescription_pdf");
    setNotice("");
    setFileError("");
    setFileAction("attach");
    try {
      if (!file?.size || file.size > PDF_LIMIT || !file.name.toLowerCase().endsWith(".pdf")
        || await file.slice(0, 5).text() !== "%PDF-") {
        setFileError("Choose a PDF file up to 5 MB.");
        return;
      }
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const path = `clinic-issued/${record.id}/${user.id}/${hash}.pdf`;
      const { error: registrationError } = await supabase.from("prescription_documents").upsert({
        prescription_record_id: record.id,
        storage_path: path,
        original_filename: file.name,
        mime_type: "application/pdf",
        uploaded_by: user.id,
      }, { onConflict: "storage_path", ignoreDuplicates: true });
      if (registrationError) throw registrationError;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: "0",
        contentType: "application/pdf",
        upsert: false,
      });
      const documents = await refreshDocuments();
      const attached = documents.find((document) => document.storage_path === path);
      if (!attached?.file_available) throw uploadError || new Error("PDF unavailable");
      form.reset();
      setNotice(attached.release_status === "released" ? "This PDF has already been released." : "PDF attached.");
    } catch {
      setFileError("The attachment could not be confirmed. Submit the same PDF again to retry.");
    } finally {
      setFileAction("");
    }
  }

  async function releasePdf() {
    if (fileAction || !releaseFile || !recipient) return;
    setFileError("");
    setNotice("");
    setFileAction("release");
    try {
      const { error: releaseError } = await supabase.from("prescription_documents").update({ release_status: "released" })
        .eq("id", releaseFile.id).eq("prescription_record_id", record.id).eq("release_status", "pending_review");
      const documents = await refreshDocuments();
      const released = documents.find((document) => document.id === releaseFile.id);
      if (released?.release_status !== "released") throw releaseError || new Error("Release not confirmed");
      setReleaseFile(null);
      setNotice("Prescription released to the customer.");
    } catch {
      setFileError("The release could not be confirmed. Try again to check its status.");
    } finally {
      setFileAction("");
    }
  }

  return (
    <dialog ref={dialogRef} className="apo-prescription-drawer apo-clinical-record-drawer" aria-labelledby="apo-clinical-record-title" onClose={onClose} onCancel={(event) => { if (fileAction) event.preventDefault(); }}>
      <header className="apo-prescription-drawer-header">
        <div>
          <p className="apo-prescription-eyebrow">Clinic-issued prescription</p>
          <h2 id="apo-clinical-record-title">{recordReference(record.id)}</h2>
          <p>Issued {formatDate(record.issued_at)} · Expires {formatDate(record.expires_at)}</p>
          {recipient && <p>Customer · {recipient}</p>}
        </div>
        <button type="button" className="apo-prescription-close" disabled={Boolean(fileAction)} onClick={() => dialogRef.current.close()} aria-label="Close record"><X size={18} aria-hidden="true" /></button>
      </header>

      <div className="apo-prescription-drawer-content">
        {loading ? <p className="apo-side-empty" role="status">Loading clinical record.</p> : (
          <>
            <section className="apo-prescription-detail-section">
              <div className="apo-prescription-section-heading"><h3>Prescription values</h3></div>
              {details ? (
                <>
                  <table className="apo-prescriptions-table">
                    <thead><tr><th scope="col">Eye</th><th scope="col">Sphere</th><th scope="col">Cylinder</th><th scope="col">Axis</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">Right</th><td>{details.right_sphere ?? "—"}</td><td>{details.right_cylinder ?? "—"}</td><td>{details.right_axis ?? "—"}</td></tr>
                      <tr><th scope="row">Left</th><td>{details.left_sphere ?? "—"}</td><td>{details.left_cylinder ?? "—"}</td><td>{details.left_axis ?? "—"}</td></tr>
                    </tbody>
                  </table>
                  {details.pupillary_distance != null && <p className="apo-prescription-permission-note">Pupillary distance: {details.pupillary_distance} mm</p>}
                  {details.prescription_notes && <p className="apo-prescription-permission-note apo-clinical-record-notes"><strong>Prescription notes</strong><br />{details.prescription_notes}</p>}
                </>
              ) : <p className="apo-side-empty" role="status">Prescription values are unavailable.</p>}
            </section>

            <section className="apo-prescription-detail-section">
              <div className="apo-prescription-section-heading"><h3>Attached files</h3></div>
              {files === null ? <p className="apo-side-empty" role="status">Attached files could not be loaded.</p>
                : files.length === 0 ? <p className="apo-side-empty">No files are attached to this record.</p>
                  : <ul className="apo-clinical-record-files">
                    {files.map((file) => (
                      <li className="apo-prescription-file-summary" key={file.id}>
                        <span className="apo-prescription-file-icon"><FileText size={16} aria-hidden="true" /></span>
                        <div><strong title={file.original_filename}>{file.original_filename}</strong><small>{file.file_available === false && file.release_status === "pending_review" ? "Upload incomplete" : releaseLabels[file.release_status] || "Unknown status"}</small></div>
                        {file.file_available !== false && <button type="button" className="apo-prescriptions-view" onClick={() => openPreview(file)} disabled={preview?.loading} aria-label={`Preview ${file.original_filename}`}>Preview</button>}
                        {recipient && file.file_available && file.mime_type === "application/pdf" && file.release_status === "pending_review" && (
                          <button type="button" className="apo-prescriptions-view" disabled={Boolean(fileAction)} onClick={() => { setReleaseFile(file); setFileError(""); setNotice(""); }}>Release to customer</button>
                        )}
                      </li>
                    ))}
                  </ul>}
              {recipient && (
                <form className="apo-clinical-lookup apo-clinical-attach" onSubmit={attachPdf}>
                  <label htmlFor="apo-clinical-pdf">Prescription PDF <small>Up to 5 MB</small></label>
                  <div>
                    <input id="apo-clinical-pdf" name="prescription_pdf" type="file" accept=".pdf,application/pdf" required disabled={Boolean(fileAction) || Boolean(releaseFile)} />
                    <button className="apo-prescriptions-refresh" type="submit" disabled={Boolean(fileAction) || Boolean(releaseFile)}><Upload size={14} aria-hidden="true" /> {fileAction === "attach" ? "Attaching…" : "Attach PDF"}</button>
                  </div>
                </form>
              )}
              {releaseFile && (
                <div className="apo-clinical-release" aria-label="Confirm release">
                  <p>Release <strong>{releaseFile.original_filename}</strong> to <strong>{recipient}</strong>?</p>
                  <button className="apo-prescriptions-refresh" type="button" disabled={Boolean(fileAction)} onClick={() => { setReleaseFile(null); setFileError(""); }}>Cancel</button>
                  <button className="apo-clinical-primary" type="button" disabled={Boolean(fileAction)} onClick={releasePdf}>{fileAction === "release" ? "Releasing…" : "Confirm release"}</button>
                </div>
              )}
              {fileError && <p className="apo-clinical-error" role="alert">{fileError}</p>}
              {notice && <p className="apo-clinical-notice" role="status">{notice}</p>}
            </section>

            {preview && (
              <section className="apo-prescription-preview-section">
                <div className="apo-prescription-preview-heading">
                  <h3>Document preview</h3>
                  {preview.url && <a href={preview.url} target="_blank" rel="noreferrer">Open file</a>}
                </div>
                <div className="apo-prescription-preview-frame">
                  {preview.loading ? <p className="apo-prescription-preview-message" role="status">Preparing secure preview.</p>
                    : preview.error ? <p className="apo-prescription-preview-message is-error" role="status">The file preview is unavailable. Try opening it again.</p>
                      : preview.file.mime_type.startsWith("image/") ? <img src={preview.url} alt={preview.file.original_filename} />
                        : <iframe src={preview.url} title={preview.file.original_filename} />}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <footer className="apo-prescription-drawer-footer"><button type="button" disabled={Boolean(fileAction)} onClick={() => dialogRef.current.close()}>Close</button></footer>
    </dialog>
  );
}

export default function OptometristClinicalRecords() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [reference, setReference] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      try {
        let query = supabase.from("prescription_records")
          .select("id, issued_at, expires_at", { count: "exact" })
          .order("issued_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
        if (reference !== null) query = query.eq("id", reference);
        const { data, count, error: loadError } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (!active) return;
        if (loadError) throw loadError;
        setRecords(data || []);
        setTotal(count ?? 0);
        setError(false);
      } catch {
        if (!active) return;
        setRecords([]);
        setTotal(0);
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadRecords();
    return () => { active = false; };
  }, [page, reference, revision]);

  function searchRecords(event) {
    event.preventDefault();
    const term = search.trim();
    const match = /^(?:rx-)?(\d{1,10})$/i.exec(term);
    const id = match ? Number(match[1]) : null;
    if (term && (id === null || id < 1 || id > 2147483647)) {
      setSearchError("Enter a record number such as RX-123.");
      return;
    }
    setSearchError("");
    setLoading(true);
    setReference(id);
    setPage(0);
    setRevision((current) => current + 1);
  }

  function changePage(nextPage) {
    setLoading(true);
    setPage(nextPage);
  }

  function openCreatedRecord(record) {
    setCreating(false);
    setSelectedRecord(record);
    setSearch("");
    setSearchError("");
    setReference(null);
    setPage(0);
    setLoading(true);
    setRevision((current) => current + 1);
  }

  return (
    <div className="apo-prescriptions-page apo-clinical-records-page">
      <header className="apo-prescriptions-header">
        <div>
          <p className="apo-prescriptions-eyebrow">Clinical review</p>
          <h1>Clinical records</h1>
          <p className="apo-prescriptions-subtitle">Look up prescriptions issued by the clinic after an eye exam.</p>
        </div>
        <div className="apo-clinical-header-actions">
          <button className="apo-prescriptions-refresh" type="button" onClick={() => {
            setLoading(true);
            setPage(0);
            setRevision((current) => current + 1);
          }} disabled={loading}>
            {loading ? <Loader2 size={15} className="is-spinning" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Refresh
          </button>
          <button className="apo-clinical-primary" type="button" onClick={() => setCreating(true)}><Plus size={15} aria-hidden="true" /> Create prescription</button>
        </div>
      </header>

      <section className="apo-prescriptions-directory" aria-labelledby="apo-clinical-record-directory">
        <div className="apo-prescriptions-directory-heading">
          <div><h2 id="apo-clinical-record-directory">Clinic-issued prescriptions</h2>{!loading && !error && <span>{total} {total === 1 ? "record" : "records"}</span>}</div>
        </div>
        <form className="apo-prescriptions-filters apo-clinical-record-search" onSubmit={searchRecords}>
          <label className="apo-prescriptions-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Clinical record reference" aria-invalid={searchError ? true : undefined} aria-describedby={searchError ? "apo-clinical-record-search-error" : undefined} placeholder="Search by reference, e.g. RX-123" value={search} onChange={(event) => { setSearch(event.target.value); setSearchError(""); }} />
          </label>
          <button type="submit" className="apo-prescriptions-refresh" disabled={loading}>Search</button>
          {reference !== null && <button type="button" className="apo-prescriptions-refresh" onClick={() => {
            setLoading(true);
            setSearch("");
            setSearchError("");
            setReference(null);
            setPage(0);
          }} disabled={loading}>Clear</button>}
        </form>
        {searchError && <p id="apo-clinical-record-search-error" className="apo-prescription-permission-note" role="alert">{searchError}</p>}
        <div className="apo-prescriptions-table-wrap">
          <table className="apo-prescriptions-table">
            <thead><tr><th scope="col">Record</th><th scope="col">Issued</th><th scope="col">Expires</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="apo-prescriptions-table-message" colSpan={4}>Loading clinical records.</td></tr>
                : error ? <tr><td className="apo-prescriptions-table-message is-error" colSpan={4}>Clinical records could not be loaded. Refresh to try again.</td></tr>
                  : records.length === 0 ? <tr><td className="apo-prescriptions-table-message" colSpan={4}><FileText size={17} aria-hidden="true" />{reference === null ? "No clinic-issued prescriptions are available." : "No record matches this reference."}</td></tr>
                    : records.map((record) => (
                      <tr key={record.id}>
                        <td><strong>{recordReference(record.id)}</strong></td><td>{formatDate(record.issued_at)}</td><td>{formatDate(record.expires_at)}</td>
                        <td><button type="button" className="apo-prescriptions-view" onClick={() => setSelectedRecord(record)} aria-label={`View record ${recordReference(record.id)}`}>View record <ArrowRight size={14} aria-hidden="true" /></button></td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
        {!error && (total > PAGE_SIZE || page > 0) && (
          <footer className="apo-prescriptions-directory-footer apo-clinical-record-pagination">
            <button className="apo-prescriptions-refresh" type="button" onClick={() => changePage(page - 1)} disabled={loading || page === 0}>Previous</button>
            <span>Page {page + 1}</span>
            <button className="apo-prescriptions-refresh" type="button" onClick={() => changePage(page + 1)} disabled={loading || (page + 1) * PAGE_SIZE >= total}>Next</button>
          </footer>
        )}
      </section>
      {creating && <CreateClinicalPrescription onClose={() => setCreating(false)} onCreated={openCreatedRecord} />}
      {selectedRecord && <ClinicalRecordDetails key={selectedRecord.id} record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </div>
  );
}
