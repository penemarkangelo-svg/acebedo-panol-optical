import { useEffect, useState } from "react";
import { Banknote, CalendarCheck, Download, RefreshCw, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabaseClient";
import { Metric, OrderBreakdown } from "./SuperAdminOverview";
import { getReportRange, getVerifiedPayments, manilaDayKey, summarizeReport } from "./superAdminReportData";
import { downloadReportExcel } from "./superAdminReportExport";
import "../../styles/SuperAdminReports.css";

const PERIODS = [
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["specific-month", "Specific month"],
  ["year", "Year"],
];

const manilaTimeZone = { timeZone: "Asia/Manila" };
const periodDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", ...manilaTimeZone });
const dailyLabel = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", ...manilaTimeZone });
const monthlyLabel = new Intl.DateTimeFormat("en-PH", { month: "long", ...manilaTimeZone });
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const number = new Intl.NumberFormat("en-PH");
const BATCH_SIZE = 250;

async function loadRows(makeQuery, signal) {
  const rows = [];
  let lastId;

  while (!signal.aborted) {
    let query = makeQuery().order("id").limit(BATCH_SIZE);
    if (lastId != null) query = query.gt("id", lastId);
    const { data, error } = await query.abortSignal(signal);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < BATCH_SIZE) return rows;
    lastId = data.at(-1).id;
  }
  return null;
}

function formatValue(formatter, value) {
  return value == null ? "—" : formatter.format(value);
}

export default function SuperAdminReports() {
  const todayKey = manilaDayKey.format(new Date());
  const [period, setPeriod] = useState("today");
  const [month, setMonth] = useState(todayKey.slice(0, 7));
  const [year, setYear] = useState(todayKey.slice(0, 4));
  const [applied, setApplied] = useState(() => ({ period: "today", range: getReportRange("today") }));
  const [result, setResult] = useState(null);
  const [invalidRange, setInvalidRange] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { range } = applied;
  const loading = result?.range !== range;
  const data = loading ? null : result.data;
  const canExport = data && [data.payment, data.orders, data.exams].some((value) => value != null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadReport() {
      const [payments, orders, exams] = await Promise.allSettled([
        supabase.rpc("get_order_payment_records").abortSignal(signal),
        loadRows(() => supabase.from("orders").select("id, created_at, order_status")
          .gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()), signal),
        loadRows(() => supabase.from("appointments").select("id, appointment_date").eq("status", "completed")
          .gte("appointment_date", range.startKey).lt("appointment_date", range.endKey), signal),
      ]);
      if (signal.aborted) return;
      const report = summarizeReport(range, {
        payments: payments.status === "fulfilled" ? getVerifiedPayments(payments.value, range) : null,
        orders: orders.status === "fulfilled" ? orders.value : null,
        exams: exams.status === "fulfilled" ? exams.value : null,
      });
      setResult({ range, data: report });
    }

    loadReport().catch(() => {
      if (!signal.aborted) setResult({ range, data: null });
    });
    return () => controller.abort();
  }, [range]);

  function applyPeriod(selection) {
    const { period, month, year } = selection;
    const nextRange = getReportRange(period, month, year);
    setInvalidRange(!nextRange);
    if (nextRange) setApplied({ period, month, year, range: nextRange });
  }

  async function exportExcel() {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      const saved = await downloadReportExcel(data, range);
      if (saved) toast.success("Excel report saved.");
    } catch {
      toast.error("The Excel file could not be saved. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const startLabel = periodDate.format(range.start);
  const endLabel = periodDate.format(range.lastDate);
  const rangeLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  const someUnavailable = !loading && (!data || [data.payment, data.orders, data.exams].some((value) => value == null));

  return (
    <div className="apo-super-overview apo-super-reports">
      <header className="apo-super-header">
        <div><h1>Reports</h1><p>Review verified payments, orders, and completed eye exams.</p></div>
        <div className="apo-super-controls">
          <button type="button" aria-label="Refresh report" title="Refresh report" disabled={loading} onClick={() => applyPeriod(applied)}><RefreshCw size={17} aria-hidden="true" /></button>
          <button type="button" className="apo-report-export" disabled={!canExport || exporting} onClick={exportExcel}>
            <Download size={16} aria-hidden="true" /> {exporting ? "Preparing Excel…" : "Export Excel"}
          </button>
        </div>
      </header>

      <section className="apo-super-panel apo-report-filter" aria-label="Report filters">
        <form className="apo-super-controls apo-report-controls" onSubmit={(event) => {
          event.preventDefault();
          applyPeriod({ period, month, year });
        }}>
          <label>Period <select value={period} onChange={(event) => { setPeriod(event.target.value); setInvalidRange(false); }}>
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {period === "specific-month" && <label>Month <input type="month" value={month} max={todayKey.slice(0, 7)} required onChange={(event) => setMonth(event.target.value)} /></label>}
          {period === "year" && <label>Year <input type="number" value={year} min="1" max={todayKey.slice(0, 4)} required onChange={(event) => setYear(event.target.value)} /></label>}
          <button type="submit" className="apo-report-apply">Apply</button>
        </form>
        <p className="apo-super-period" aria-live="polite">{rangeLabel} · Philippine time</p>
        {invalidRange && <p className="apo-report-notice" role="alert">Choose a valid month or year up to today.</p>}
      </section>

      <section className="apo-super-metrics apo-report-metrics" aria-label="Report totals" aria-busy={loading}>
        <Metric label="Verified payments" value={formatValue(currency, data?.payment)} description="Payments confirmed in this period" icon={Banknote} featured />
        <Metric label="Orders placed" value={formatValue(number, data?.orders)} description="Orders created in this period" icon={ShoppingBag} />
        <Metric label="Completed eye exams" value={formatValue(number, data?.exams)} description="Completed visits by appointment date" icon={CalendarCheck} />
      </section>
      {someUnavailable && <p className="apo-report-notice" role="status">Some totals are unavailable. Refresh the report to try again.</p>}

      <div className="apo-super-columns apo-report-columns">
        <section className="apo-super-panel" aria-labelledby="apo-report-breakdown">
          <header><h2 id="apo-report-breakdown">{range.byMonth ? "Monthly breakdown" : "Daily breakdown"}</h2></header>
          {loading ? <p className="apo-super-empty" role="status">Loading report.</p>
            : !data ? <p className="apo-super-empty">Report details are unavailable.</p> : (
              <div className="apo-super-table-wrap" role="region" aria-label="Report breakdown" tabIndex={0}>
                <table className="apo-super-table apo-report-table">
                  <thead><tr><th scope="col">{range.byMonth ? "Month" : "Date"}</th><th scope="col">Verified payments</th><th scope="col">Orders</th><th scope="col">Completed exams</th></tr></thead>
                  <tbody>{data.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row"><time dateTime={row.key}>{(range.byMonth ? monthlyLabel : dailyLabel).format(row.date)}</time></th>
                      <td>{formatValue(currency, row.payment)}</td>
                      <td>{formatValue(number, row.orders)}</td>
                      <td>{formatValue(number, row.exams)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
        </section>
        <OrderBreakdown statuses={data?.statuses} total={data?.orders} loading={loading} />
      </div>
    </div>
  );
}
