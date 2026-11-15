import { useCallback, useEffect, useMemo, useState } from "react";
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

function DocumentPreview({ document, onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
          <section className="apo-prescription-detail-section">
            <div className="apo-prescription-section-heading"><UserRound size={16} /><h3>Customer and order</h3></div>
            <dl className="apo-prescription-detail-grid">
              <div><dt>Customer</dt><dd>{document.order?.customer_name || "Customer details unavailable"}</dd></div>
              <div><dt>Email</dt><dd>{document.order?.email || "Not provided"}</dd></div>
              <div><dt>Order status</dt><dd>{document.order?.order_status?.replaceAll("_", " ") || "Unavailable"}</dd></div>
              <div><dt>Order placed</dt><dd>{document.order?.created_at ? formatDate(document.order.created_at) : "Unavailable"}</dd></div>
            </dl>
          </section>

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
            <p className="apo-prescription-permission-note">Admins can view this file for order administration. Only an Optometrist can verify it or request a replacement.</p>
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
        </div>

        <footer className="apo-prescription-drawer-footer">
          <Link to={`/admin/orders/${document.order_id}`} onClick={onClose}>View related order <ArrowRight size={14} /></Link>
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </aside>
    </div>
  );
}

export default function AdminPrescriptionDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [orderDataUnavailable, setOrderDataUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data: uploads, error: uploadError } = await supabase
      .from("order_prescription_uploads")
      .select("id, order_id, storage_path, original_filename, mime_type, status, uploaded_at, reviewed_at")
      .order("uploaded_at", { ascending: false })
      .limit(500);

    if (uploadError) {
      console.error("Could not load prescription documents:", uploadError);
      setDocuments([]);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const rows = uploads || [];
    const orderIds = [...new Set(rows.map((upload) => upload.order_id))];
    let orders = [];
    if (orderIds.length) {
      const { data: orderRows, error: orderError } = await supabase
        .from("orders")
        .select("id, customer_name, email, order_status, created_at")
        .in("id", orderIds);
      if (orderError) {
        console.error("Could not load related order details:", orderError);
        setOrderDataUnavailable(true);
      } else {
        orders = orderRows || [];
        setOrderDataUnavailable(false);
      }
    } else {
      setOrderDataUnavailable(false);
    }

    const orderById = new Map(orders.map((order) => [order.id, order]));
    setDocuments(rows.map((upload) => ({ ...upload, order: orderById.get(upload.order_id) || null })));
    setLoading(false);
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

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

  return (
    <div className="apo-prescriptions-page">
      <header className="apo-prescriptions-header">
        <div><p className="apo-prescriptions-eyebrow">Eye care</p><h1>Prescription Documents</h1><p className="apo-prescriptions-subtitle">Track customer-uploaded prescriptions and their Optometrist review status.</p></div>
        <button className="apo-prescriptions-refresh" type="button" onClick={loadDocuments} disabled={loading} aria-label="Refresh prescription documents">
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
          <label className="apo-prescriptions-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, order, or filename" aria-label="Search prescription documents" /></label>
          <label><span>Review status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{REVIEW_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <div className="apo-prescriptions-table-wrap apo-admin-fit-table-wrap"><table className="apo-prescriptions-table apo-admin-fit-table"><thead><tr><th>Order</th><th>Customer</th><th>Document</th><th>Uploaded</th><th>Review status</th><th>Action</th></tr></thead>
          <tbody>{loading ? <tr><td className="apo-prescriptions-table-message" colSpan="6"><Loader2 size={17} className="is-spinning" /> Loading prescription documents…</td></tr>
            : loadError ? <tr><td className="apo-prescriptions-table-message is-error" colSpan="6"><AlertCircle size={17} /> Document records could not be loaded. Refresh to try again.</td></tr>
              : filteredDocuments.length === 0 ? <tr><td className="apo-prescriptions-table-message" colSpan="6"><FileText size={18} /> No prescription documents match these filters.</td></tr>
                : filteredDocuments.map((document) => {
                  const review = REVIEW_DISPLAY[document.status] || { label: "Status unavailable", shortLabel: "Unavailable", tone: "unknown", icon: AlertCircle };
                  const StatusIcon = review.icon;
                  return <tr key={document.id}>
                    <td><strong>{orderReference(document.order_id)}</strong><small>{document.order?.order_status?.replaceAll("_", " ") || "Order details unavailable"}</small></td>
                    <td><strong>{document.order?.customer_name || "Customer details unavailable"}</strong><small>{document.order?.email || "Email not provided"}</small></td>
                    <td><span className="apo-prescriptions-file-name">{document.mime_type?.startsWith("image/") ? <FileImage size={15} /> : <FileText size={15} />}{document.original_filename || "Uploaded document"}</span><small>{document.mime_type || "File type unavailable"}</small></td>
                    <td>{formatDate(document.uploaded_at)}</td>
                    <td><span className={`apo-prescriptions-status is-${review.tone}`}><StatusIcon size={13} />{review.shortLabel}</span></td>
                    <td><button className="apo-prescriptions-view" type="button" onClick={() => setSelectedDocument(document)}>View file <ArrowRight size={14} /></button></td>
                  </tr>;
                })}
          </tbody></table></div>
        <footer className="apo-prescriptions-directory-footer"><span>Showing {filteredDocuments.length} of {documents.length} uploaded documents{documents.length === 500 ? " (latest 500)" : ""}</span><span>{orderDataUnavailable ? "Related order details are unavailable" : "Review decisions are managed by Optometrists"}</span></footer>
      </section>

      <p className="apo-prescriptions-privacy-note"><ShieldCheck size={14} /> Only customer-uploaded order prescriptions appear here. Clinic-issued prescriptions remain in their separate workflow.</p>
      {selectedDocument && <DocumentPreview document={selectedDocument} onClose={() => setSelectedDocument(null)} />}
    </div>
  );
}
