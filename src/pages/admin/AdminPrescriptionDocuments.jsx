import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { indexCurrentPrescriptionUploads } from "../../lib/orderPrescriptionUploads";
import { PRESCRIPTION_REVIEW_ORDER_STATUSES, VERIFIED_PAYMENT_STEP } from "./orderPrescriptionReview";
import "../../styles/AdminPrescriptionDocuments.css";

const REVIEW_FILTERS = [
  ["all", "All review statuses"],
  ["pending_review", "Awaiting Optometrist"],
  ["validated", "Verified"],
  ["rejected", "Resubmission needed"],
];

const REVIEW_DISPLAY = {
  pending_review: { label: "Awaiting Optometrist", shortLabel: "Awaiting review", tone: "pending", icon: Clock3 },
  validated: { label: "Verified by Optometrist", shortLabel: "Verified", tone: "verified", icon: CheckCircle2 },
  rejected: { label: "Resubmission needed", shortLabel: "Resubmission", tone: "rejected", icon: AlertCircle },
};

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function orderReference(id) {
  return `#APO-${id}`;
}

function DocumentPreview({ document, onClose, reviewMode, onReviewSaved, onReviewConflict }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(null);
  const isImage = document.mime_type?.startsWith("image/");
  const StatusIcon = REVIEW_DISPLAY[document.status]?.icon || FileText;

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      setLoading(true);
      setError(false);
      setUrl("");
      const { data, error: signedUrlError } = await supabase
        .storage
        .from("prescription-uploads")
        .createSignedUrl(document.storage_path, 300);
      if (cancelled) return;
      if (signedUrlError || !data?.signedUrl) {
        console.error("Could not create prescription document preview:", signedUrlError);
        setError(true);
      } else {
        setUrl(data.signedUrl);
      }
      setLoading(false);
    };
    loadPreview();
    return () => { cancelled = true; };
  }, [document.id, document.storage_path]);

  useEffect(() => {
    if (!reviewMode) return undefined;
    let active = true;
    supabase.from("order_prescription_uploads")
      .select("id, original_filename, uploaded_at, status, reviewed_at, review_notes")
      .eq("order_id", document.order_id)
      .order("id", { ascending: false })
      .then(({ data, error: historyError }) => {
        if (active) setHistory(historyError ? false : data);
      });
    return () => { active = false; };
  }, [document.order_id, reviewMode]);

  return (
    <div className="apo-prescription-overlay" role="presentation">
      <button className="apo-prescription-backdrop" type="button" aria-label="Close document details" onClick={onClose} />
      <aside className="apo-prescription-drawer" role="dialog" aria-modal="true" aria-labelledby="apo-prescription-detail-title">
        <header className="apo-prescription-drawer-header">
          <div>
            <p className="apo-prescription-eyebrow">Order prescription</p>
            <h2 id="apo-prescription-detail-title">{orderReference(document.order_id)}</h2>
            <p>Uploaded {formatDate(document.uploaded_at)}</p>
          </div>
          <button type="button" className="apo-prescription-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="apo-prescription-drawer-content">
          {!reviewMode && <section className="apo-prescription-detail-section">
            <div className="apo-prescription-section-heading"><UserRound size={16} /><h3>Customer and order</h3></div>
            <dl className="apo-prescription-detail-grid">
              <div><dt>Customer</dt><dd>{document.order?.customer_name || "Customer details unavailable"}</dd></div>
              <div><dt>Email</dt><dd>{document.order?.email || "Not provided"}</dd></div>
              <div><dt>Order status</dt><dd>{document.order?.order_status?.replaceAll("_", " ") || "Unavailable"}</dd></div>
              <div><dt>Order placed</dt><dd>{document.order?.created_at ? formatDate(document.order.created_at) : "Unavailable"}</dd></div>
            </dl>
          </section>}

          <section className="apo-prescription-detail-section">
            <div className="apo-prescription-section-heading"><FileText size={16} /><h3>Uploaded file</h3></div>
            <div className="apo-prescription-file-summary">
              <span className="apo-prescription-file-icon">{isImage ? <FileImage size={18} /> : <FileText size={18} />}</span>
              <div><strong>{document.original_filename || "Prescription document"}</strong><small>{document.mime_type || "File type unavailable"}</small></div>
            </div>
          </section>

          <section className="apo-prescription-detail-section">
            <div className="apo-prescription-section-heading"><ShieldCheck size={16} /><h3>Optometrist review</h3></div>
            <div className={`apo-prescription-review-state is-${REVIEW_DISPLAY[document.status]?.tone || "unknown"}`}>
              <StatusIcon size={17} />
              <div><strong>{REVIEW_DISPLAY[document.status]?.label || "Status unavailable"}</strong><small>{document.reviewed_at ? `Reviewed ${formatDate(document.reviewed_at)}` : "Review status is managed by an Optometrist."}</small></div>
            </div>
            {reviewMode && document.review_notes && <p className="apo-prescription-permission-note">Reason shared with customer: {document.review_notes}</p>}
            {!reviewMode && <p className="apo-prescription-permission-note">Admins can view this file for order administration. Only an Optometrist can verify it or request a replacement.</p>}
          </section>

          <section className="apo-prescription-preview-section">
            <div className="apo-prescription-preview-heading"><h3>Document preview</h3>{url && <a href={url} target="_blank" rel="noreferrer"><Download size={14} /> Open file</a>}</div>
            <div className="apo-prescription-preview-frame">
              {loading ? <div className="apo-prescription-preview-message"><Loader2 className="is-spinning" size={20} /> Preparing secure preview…</div>
                : error ? <div className="apo-prescription-preview-message is-error"><AlertCircle size={20} /><span>The file preview is unavailable. Check document access and try again.</span></div>
                  : isImage ? <img src={url} alt={`Uploaded prescription for order ${document.order_id}`} />
                    : <iframe src={url} title={`Prescription document for order ${document.order_id}`} />}
            </div>
            <small className="apo-prescription-preview-expiry">The secure preview link expires after five minutes.</small>
          </section>
          {reviewMode && document.status === "pending_review" && (
            <ReviewDecision documentId={document.id} previewReady={Boolean(url)} onSaved={onReviewSaved} onConflict={onReviewConflict} />
          )}
          {reviewMode && (history === false || history?.some((upload) => upload.id !== document.id)) && (
            <section className="apo-prescription-detail-section">
              <div className="apo-prescription-section-heading"><Clock3 size={16} /><h3>Previous uploads for this order</h3></div>
              {history === false ? <p>Previous uploads could not be loaded.</p> : (
                <ul className="apo-prescription-upload-history">
                  {history.filter((upload) => upload.id !== document.id).map((upload) => (
                    <li key={upload.id}>
                      <strong>{upload.original_filename || "Prescription document"}</strong>
                      <small>Uploaded {formatDate(upload.uploaded_at)}</small>
                      <small>{REVIEW_DISPLAY[upload.status]?.label || "Review status unavailable"}{upload.reviewed_at ? ` · ${formatDate(upload.reviewed_at)}` : ""}</small>
                      {upload.review_notes && <p>{upload.review_notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <footer className="apo-prescription-drawer-footer">
          {!reviewMode && <Link to={`/admin/orders/${document.order_id}`} onClick={onClose}>View related order <ArrowRight size={14} /></Link>}
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </aside>
    </div>
  );
}

function ReviewDecision({ documentId, previewReady, onSaved, onConflict }) {
  const { user } = useAuth();
  const [decision, setDecision] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [reviewedLegibility, setReviewedLegibility] = useState(false);
  const [saving, setSaving] = useState(false);
  const isRequestingReplacement = decision === "rejected";
  const canSaveReview = Boolean(user?.id && previewReady && !saving && (
    (decision === "validated" && reviewedLegibility) ||
    (isRequestingReplacement && replacementReason.trim())
  ));

  async function saveDecision(event) {
    event.preventDefault();
    if (!canSaveReview) return;

    setSaving(true);
    try {
      const reviewedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("order_prescription_uploads")
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: reviewedAt,
          updated_at: reviewedAt,
          review_notes: isRequestingReplacement ? replacementReason.trim() : null,
        })
        .eq("id", documentId)
        .eq("status", "pending_review")
        .select("id, status, reviewed_at, review_notes")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("This upload could not be updated. Check its latest review status and your access.");
        onConflict();
        return;
      }

      onSaved(data);
      toast.success(decision === "validated" ? "Prescription verified." : "Replacement requested.");
    } catch {
      toast.error("The review could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="apo-prescription-review-form" onSubmit={saveDecision}>
      <label htmlFor="apo-prescription-review-decision">Review decision</label>
      <div>
        <select id="apo-prescription-review-decision" value={decision} onChange={(event) => setDecision(event.target.value)} disabled={saving} required>
          <option value="">Select a decision</option>
          <option value="validated">Verify prescription</option>
          <option value="rejected">Request replacement</option>
        </select>
        {decision === "validated" && (
          <label className="apo-prescription-verification-check">
            <input type="checkbox" checked={reviewedLegibility} onChange={(event) => setReviewedLegibility(event.target.checked)} disabled={!previewReady || saving} />
            <span>I checked that the whole prescription and its issue date are readable.</span>
          </label>
        )}
        {isRequestingReplacement && (
          <label className="apo-prescription-replacement-reason">Reason shown to the customer
            <textarea rows={3} maxLength={300} required disabled={saving}
              placeholder="For example, please upload a clearer photo that shows the date issued."
              value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} />
          </label>
        )}
        <button type="submit" disabled={!canSaveReview}>{saving ? "Saving…" : "Save review"}</button>
      </div>
    </form>
  );
}

export default function AdminPrescriptionDocuments({ reviewMode = false }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      try {
        const uploadColumns = "id, order_id, storage_path, original_filename, mime_type, status, uploaded_at, reviewed_at";
        let query = supabase
          .from("order_prescription_uploads")
          .select(reviewMode ? `${uploadColumns}, review_notes` : `${uploadColumns}, order:orders!inner(customer_name, email, order_status, created_at)`);
        if (!reviewMode) {
          query = query.in("order.order_status", PRESCRIPTION_REVIEW_ORDER_STATUSES)
            .eq("order.step_statuses->>2", VERIFIED_PAYMENT_STEP);
        }
        const { data: uploads, error: uploadError } = await query
          .order("id", { ascending: false })
          .limit(500);
        if (!active) return;
        if (uploadError) throw uploadError;

        setDocuments(Array.from(indexCurrentPrescriptionUploads(uploads || []).values()));
        setLoadError(false);
      } catch {
        if (!active) return;
        setDocuments([]);
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDocuments();
    return () => { active = false; };
  }, [reviewMode, loadVersion]);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      document.original_filename,
      document.order?.customer_name,
      document.order?.email,
      document.order_id,
      `apo-${document.order_id}`,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "all" || document.status === statusFilter);
  }), [documents, search, statusFilter]);

  const pendingCount = documents.filter((document) => document.status === "pending_review").length;
  const verifiedCount = documents.filter((document) => document.status === "validated").length;
  const resubmissionCount = documents.filter((document) => document.status === "rejected").length;
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId);
  const columnCount = reviewMode ? 5 : 6;

  function handleReviewSaved(review) {
    setDocuments((current) => current.map((document) => document.id === review.id ? { ...document, ...review } : document));
  }

  function refreshDocuments() {
    setLoading(true);
    setLoadVersion((current) => current + 1);
  }

  return (
    <div className={reviewMode ? "apo-prescriptions-page is-review-mode" : "apo-prescriptions-page"}>
      <header className="apo-prescriptions-header">
        <div>
          <p className="apo-prescriptions-eyebrow">{reviewMode ? "Clinical review" : "Eye care"}</p>
          <h1>{reviewMode ? "Prescription review" : "Prescription Documents"}</h1>
          <p className="apo-prescriptions-subtitle">{reviewMode ? "Review prescriptions uploaded with customer orders. Verify the file or request a replacement." : "Track uploaded prescriptions and their review status for orders with verified payment."}</p>
        </div>
        <button className="apo-prescriptions-refresh" type="button" onClick={refreshDocuments} disabled={loading} aria-label="Refresh prescription documents">
          {loading ? <Loader2 size={15} className="is-spinning" /> : <RefreshCw size={15} />} Refresh
        </button>
      </header>

      <section className="apo-prescriptions-metrics" aria-label="Prescription document overview">
        <article><span>Uploaded documents</span><strong>{loading || loadError ? "—" : documents.length}</strong><small>Files attached to customer orders</small></article>
        <article className={pendingCount ? "is-attention" : ""}><span>Awaiting review</span><strong>{loading || loadError ? "—" : pendingCount}</strong><small>Optometrist review needed</small></article>
        <article><span>Verified</span><strong>{loading || loadError ? "—" : verifiedCount}</strong><small>Reviewed by an Optometrist</small></article>
        <article className={resubmissionCount ? "is-resubmission" : ""}><span>Resubmission needed</span><strong>{loading || loadError ? "—" : resubmissionCount}</strong><small>Customer needs to upload a new file</small></article>
      </section>

      <section className="apo-prescriptions-directory">
        <div className="apo-prescriptions-directory-heading"><div><h2>Document directory</h2><span>{filteredDocuments.length} {filteredDocuments.length === 1 ? "file" : "files"}</span></div><span>Newest uploads first</span></div>
        <div className="apo-prescriptions-filters">
          <label className="apo-prescriptions-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={reviewMode ? "Search order or filename" : "Search customer, order, or filename"} aria-label="Search prescription documents" /></label>
          <label><span>Review status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{REVIEW_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <div className="apo-prescriptions-table-wrap apo-admin-fit-table-wrap"><table className="apo-prescriptions-table apo-admin-fit-table"><thead><tr><th>Order</th>{!reviewMode && <th>Customer</th>}<th>Document</th><th>Uploaded</th><th>Review status</th><th>Action</th></tr></thead>
          <tbody>{loading ? <tr><td className="apo-prescriptions-table-message" colSpan={columnCount}><Loader2 size={17} className="is-spinning" /> Loading prescription documents…</td></tr>
            : loadError ? <tr><td className="apo-prescriptions-table-message is-error" colSpan={columnCount}><AlertCircle size={17} /> Document records could not be loaded. Refresh to try again.</td></tr>
              : filteredDocuments.length === 0 ? <tr><td className="apo-prescriptions-table-message" colSpan={columnCount}><FileText size={18} /> No prescription documents match these filters.</td></tr>
                : filteredDocuments.map((document) => {
                  const review = REVIEW_DISPLAY[document.status] || { label: "Status unavailable", shortLabel: "Unavailable", tone: "unknown", icon: AlertCircle };
                  const StatusIcon = review.icon;
                  return <tr key={document.id}>
                    <td><strong>{orderReference(document.order_id)}</strong>{!reviewMode && <small>{document.order?.order_status?.replaceAll("_", " ") || "Order details unavailable"}</small>}</td>
                    {!reviewMode && <td><strong>{document.order?.customer_name || "Customer details unavailable"}</strong><small>{document.order?.email || "Email not provided"}</small></td>}
                    <td><span className="apo-prescriptions-file-name">{document.mime_type?.startsWith("image/") ? <FileImage size={15} /> : <FileText size={15} />}{document.original_filename || "Uploaded document"}</span><small>{document.mime_type || "File type unavailable"}</small></td>
                    <td>{formatDate(document.uploaded_at)}</td>
                    <td><span className={`apo-prescriptions-status is-${review.tone}`}><StatusIcon size={13} />{review.shortLabel}</span></td>
                    <td><button className="apo-prescriptions-view" type="button" onClick={() => setSelectedDocumentId(document.id)}>{reviewMode && document.status === "pending_review" ? "Review file" : "View file"} <ArrowRight size={14} /></button></td>
                  </tr>;
                })}
          </tbody></table></div>
        <footer className="apo-prescriptions-directory-footer"><span>Showing {filteredDocuments.length} of {documents.length} uploaded documents{documents.length === 500 ? " (latest 500)" : ""}</span>{!reviewMode && <span>Review decisions are managed by Optometrists</span>}</footer>
      </section>

      <p className="apo-prescriptions-privacy-note"><ShieldCheck size={14} /> Only customer-uploaded order prescriptions appear here. Clinic-issued prescriptions remain in their separate workflow.</p>
      {!loading && selectedDocument && (
        <DocumentPreview key={selectedDocument.id} document={selectedDocument} onClose={() => setSelectedDocumentId(null)} reviewMode={reviewMode} onReviewSaved={handleReviewSaved} onReviewConflict={refreshDocuments} />
      )}
    </div>
  );
}
