import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import AccountLoading from "../components/AccountLoading";

export default function AccountPrescriptionsSection({ checkingAccess = false }) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const userId = checkingAccess ? null : user?.id;
  useEffect(() => {
    let active = true;
    async function loadRecords() {
      const { data, error } = await supabase.from("prescription_records")
        .select("id, created_at, expires_at, right_sphere, right_cylinder, right_axis, left_sphere, left_cylinder, left_axis, pupillary_distance, prescription_notes, prescription_documents(id, original_filename, storage_path, mime_type)")
        .eq("user_id", userId).eq("prescription_documents.release_status", "released")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("Unable to load your optical records.");
      else setRecords(data || []);
      setLoading(false);
    }
    if (userId) loadRecords();
    return () => { active = false; };
  }, [userId]);

  async function downloadPrescription(file) {
    setDownloading(file.id);
    try {
      const { data, error } = await supabase.storage.from("prescription-uploads").download(file.storage_path);
      if (error || !data) throw error || new Error("File unavailable");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.original_filename || "Acebedo-prescription.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Unable to download this prescription. Try again or contact the clinic.");
    } finally {
      setDownloading(null);
    }
  }
  const value = (n) => n == null ? "—" : Number(n).toFixed(2);
  return <section className="account-panel-card account-prescriptions-panel"><p className="account-panel-eyebrow">OPTICAL RECORDS</p><h2>Saved prescriptions</h2><p className="account-panel-intro">Prescription records saved to your account.</p>
    {checkingAccess || loading ? <AccountLoading section="prescriptions" /> : records.length === 0 ? <p className="account-record-message">No saved prescription records yet.</p> : <div className="account-record-list">{records.map((record) => <article className="account-record-card" key={record.id}><div className="account-record-card-heading"><strong>Prescription record</strong><span>{record.created_at ? new Date(record.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Date unavailable"}</span></div><div className="account-prescription-grid"><div><b>Eye</b><b>Sphere</b><b>Cylinder</b><b>Axis</b><span>Right</span><span>{value(record.right_sphere)}</span><span>{value(record.right_cylinder)}</span><span>{record.right_axis ?? "—"}</span><span>Left</span><span>{value(record.left_sphere)}</span><span>{value(record.left_cylinder)}</span><span>{record.left_axis ?? "—"}</span></div></div>{record.pupillary_distance != null && <p className="account-record-meta">Pupillary distance: {value(record.pupillary_distance)} mm</p>}{record.expires_at && <p className="account-record-meta">Expires: {new Date(record.expires_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</p>}{record.prescription_notes && <p className="account-record-meta">Notes: {record.prescription_notes}</p>}{(record.prescription_documents || []).filter((file) => file.mime_type === "application/pdf").map((file) => (
      <button className="account-prescription-download" type="button" key={file.id} disabled={downloading !== null} onClick={() => downloadPrescription(file)}>
        {downloading === file.id ? "Downloading…" : "Download prescription PDF"}
      </button>
    ))}</article>)}</div>}
    <p className="account-clinical-note">Use optical records as provided by your eye care professional. Vision screening results are preliminary and are not a diagnosis.</p>
  </section>;
}
