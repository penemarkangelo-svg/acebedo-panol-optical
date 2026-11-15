import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/AdminPayments.css";

const PAYMENT_STATUSES = [
  ["all", "All statuses"],
  ["pending", "Pending"],
  ["paid", "Paid"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
];

const STATUS_DISPLAY = {
  pending: { label: "Pending", tone: "pending", icon: Clock3 },
  paid: { label: "Paid", tone: "paid", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "failed", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "cancelled", icon: XCircle },
};

function paymentReference(id) {
  return `PAY-${id}`;
}

function orderReference(id) {
  return `#APO-${id}`;
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function PaymentDetails({ payment, onClose }) {
  const order = payment.order;
  const status = STATUS_DISPLAY[payment.status] || { label: "Unknown", tone: "unknown", icon: AlertCircle };
  const StatusIcon = status.icon;
  const isManualReview = order?.order_status === "manual_review";

  return (
    <div className="apo-payment-overlay" role="presentation">
      <button className="apo-payment-backdrop" type="button" aria-label="Close payment details" onClick={onClose} />
      <aside className="apo-payment-drawer" role="dialog" aria-modal="true" aria-labelledby="apo-payment-drawer-title">
        <header className="apo-payment-drawer-header">
          <div><p className="apo-payment-eyebrow">Payment record</p><h2 id="apo-payment-drawer-title">{paymentReference(payment.id)}</h2><p>Created {formatDate(payment.created_at)}</p></div>
          <button className="apo-payment-close" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="apo-payment-drawer-content">
          {isManualReview && <div className="apo-payment-hold-note"><AlertCircle size={17} /><p><strong>Related order is on manual review.</strong> Payment confirmation does not make this order ready for fulfillment. Follow the payment and inventory reconciliation workflow before staff prepare or release it.</p></div>}

          <section className="apo-payment-detail-section">
            <div className="apo-payment-section-heading"><ShieldCheck size={16} /><h3>Payment status</h3></div>
            <div className={`apo-payment-detail-status is-${status.tone}`}><StatusIcon size={18} /><div><strong>{status.label}</strong><small>{payment.paid_at ? `Confirmed ${formatDate(payment.paid_at)}` : payment.status === "pending" ? "Awaiting verified payment confirmation" : "No paid confirmation recorded"}</small></div></div>
          </section>

          <section className="apo-payment-detail-section">
            <div className="apo-payment-section-heading"><FileText size={16} /><h3>Payment details</h3></div>
            <dl className="apo-payment-detail-grid">
              <div><dt>Amount</dt><dd className="apo-payment-amount">{formatMoney(payment.amount)}</dd></div>
              <div><dt>Method</dt><dd>{payment.payment_method === "qrph" ? "QR Ph" : payment.payment_method === "gcash" ? "GCash" : payment.payment_method || "—"}</dd></div>
              <div><dt>Provider</dt><dd>{payment.provider === "paymongo" ? "PayMongo" : payment.provider || "—"}</dd></div>
              <div><dt>Currency</dt><dd>{payment.currency || "PHP"}</dd></div>
              <div className="apo-payment-reference-field"><dt>Provider payment reference</dt><dd>{payment.paymongo_payment_id || "Not assigned"}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(payment.updated_at)}</dd></div>
            </dl>
          </section>

          <section className="apo-payment-detail-section">
            <div className="apo-payment-section-heading"><UserRound size={16} /><h3>Related order</h3></div>
            <dl className="apo-payment-detail-grid">
              <div><dt>Order</dt><dd>{order ? orderReference(order.id) : orderReference(payment.order_id)}</dd></div>
              <div><dt>Customer</dt><dd>{order?.customer_name || "Order details unavailable"}</dd></div>
              <div><dt>Order status</dt><dd className="apo-payment-capitalize">{order?.order_status?.replaceAll("_", " ") || "Unavailable"}</dd></div>
              <div><dt>Fulfillment</dt><dd>{order?.fulfillment_method ? order.fulfillment_method.replaceAll("_", " ") : "Unavailable"}</dd></div>
            </dl>
          </section>

          <div className="apo-payment-readonly-note"><ShieldCheck size={15} /><p>Payment status is read-only here. It changes only through the trusted payment confirmation workflow; staff cannot mark a payment as paid manually.</p></div>
        </div>
        <footer className="apo-payment-drawer-footer">
          {order && <Link to={`/admin/orders/${order.id}`} onClick={onClose}>View order <ArrowRight size={14} /></Link>}
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </aside>
    </div>
  );
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: paymentRows, error } = await supabase
      .from("payments")
      .select("id, order_id, provider, payment_method, paymongo_payment_id, amount, currency, status, paid_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Could not load the payment ledger:", error);
      setPayments([]);
      setLoadError(error);
      setLoading(false);
      return;
    }

    const rows = paymentRows || [];
    const orderIds = [...new Set(rows.map((payment) => payment.order_id))];
    let orders = [];
    if (orderIds.length) {
      const { data, error: orderError } = await supabase
        .from("orders")
        .select("id, customer_name, email, fulfillment_method, order_status, created_at")
        .in("id", orderIds);
      if (orderError) {
        console.error("Could not load related payment orders:", orderError);
        setOrdersUnavailable(true);
      } else {
        orders = data || [];
        setOrdersUnavailable(false);
      }
    } else {
      setOrdersUnavailable(false);
    }
    const orderById = new Map(orders.map((order) => [order.id, order]));
    setPayments(rows.map((payment) => ({ ...payment, order: orderById.get(payment.order_id) || null })));
    setLoading(false);
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      paymentReference(payment.id),
      payment.paymongo_payment_id,
      orderReference(payment.order_id),
      payment.order?.customer_name,
      payment.order?.email,
      payment.status,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "all" || payment.status === statusFilter);
  }), [payments, search, statusFilter]);

  const permissionError = loadError && (loadError.code === "42501" || loadError.code === "PGRST301" || /permission|row-level security|not allowed/i.test(loadError.message || ""));

  return (
    <div className="apo-payments-page">
      <header className="apo-payments-header">
        <div><p className="apo-payments-eyebrow">Commerce</p><h1>Payment Management</h1><p className="apo-payments-subtitle">Review QR Ph payment records and the orders they belong to.</p></div>
        <button className="apo-payments-refresh" type="button" onClick={loadPayments} disabled={loading} aria-label="Refresh payments">
          {loading ? <Loader2 size={15} className="is-spinning" /> : <RefreshCw size={15} />} Refresh
        </button>
      </header>

      <section className="apo-payments-directory">
        <div className="apo-payments-directory-heading"><div><h2>Payment records</h2><span>{loadError ? "Unavailable" : `${filteredPayments.length} ${filteredPayments.length === 1 ? "record" : "records"}`}</span></div><span>Newest first · QR Ph through PayMongo</span></div>
        <div className="apo-payments-filters">
          <label className="apo-payments-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payment, order, customer, or reference" aria-label="Search payment records" /></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{PAYMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="apo-payments-table-wrap apo-admin-fit-table-wrap"><table className="apo-payments-table apo-admin-fit-table"><thead><tr><th>Payment</th><th>Order / customer</th><th>Received</th><th>Method</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{loading ? <tr><td className="apo-payments-table-message" colSpan="7"><Loader2 size={17} className="is-spinning" /> Loading payment records…</td></tr>
            : loadError ? <tr><td className="apo-payments-table-message is-error" colSpan="7"><AlertCircle size={18} /><div><strong>{permissionError ? "Payment records are not available to this admin account yet." : "Payment records could not be loaded."}</strong><small>{permissionError ? "Admin read access to the protected payment ledger needs to be enabled before transactions can appear here." : "Refresh to try again. If the problem continues, check payment data access."}</small></div></td></tr>
              : filteredPayments.length === 0 ? <tr><td className="apo-payments-table-message" colSpan="7"><FileText size={18} />{payments.length ? "No payment records match these filters." : "No payment records are available yet."}</td></tr>
                : filteredPayments.map((payment) => {
                  const status = STATUS_DISPLAY[payment.status] || { label: "Unknown", tone: "unknown", icon: AlertCircle };
                  const StatusIcon = status.icon;
                  return <tr key={payment.id}>
                    <td><strong>{paymentReference(payment.id)}</strong><small>{payment.provider === "paymongo" ? "PayMongo" : payment.provider}</small></td>
                    <td><strong>{orderReference(payment.order_id)}</strong><small>{payment.order?.customer_name || "Customer details unavailable"}</small></td>
                    <td>{formatDate(payment.paid_at || payment.created_at)}</td>
                    <td>{payment.payment_method === "qrph" ? "QR Ph" : payment.payment_method || "—"}</td>
                    <td className="apo-payments-amount">{formatMoney(payment.amount)}</td>
                    <td><span className={`apo-payments-status is-${status.tone}`}><StatusIcon size={13} />{status.label}</span></td>
                    <td><button className="apo-payments-view" type="button" onClick={() => setSelectedPayment(payment)}>Details <ArrowRight size={14} /></button></td>
                  </tr>;
                })}
          </tbody></table></div>
        <footer className="apo-payments-directory-footer"><span>{loadError ? "Payment record count is unavailable" : `Showing ${filteredPayments.length} of ${payments.length} payment records${payments.length === 500 ? " (latest 500)" : ""}`}</span><span>{ordersUnavailable ? "Related order information is unavailable" : "Payment status cannot be edited manually"}</span></footer>
      </section>

      <p className="apo-payments-note"><ShieldCheck size={14} /> Payment confirmation must come from the trusted PayMongo payment workflow. This screen is for reviewing recorded transactions.</p>
      {selectedPayment && <PaymentDetails payment={selectedPayment} onClose={() => setSelectedPayment(null)} />}
    </div>
  );
}
