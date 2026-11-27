import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Banknote, CalendarCheck, RefreshCw, ShoppingBag, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getVerifiedPayments, manilaDayKey as dayKey, ORDER_STATUS_GROUPS } from "./superAdminReportData";
import "../../styles/SuperAdminOverview.css";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const axisCurrency = new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("en-PH");
const percentage = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

function getManilaRange(days) {
  const today = new Date(`${dayKey.format(new Date())}T00:00:00+08:00`);
  const dayMs = 86_400_000;
  const dates = Array.from({ length: days }, (_, index) => new Date(today.getTime() - (days - 1 - index) * dayMs));
  return { dates, start: dates[0], end: new Date(today.getTime() + dayMs) };
}

export function Metric({ label, value, description, icon, featured }) {
  const Icon = icon;
  return (
    <article className={`apo-super-metric${featured ? " is-featured" : ""}`}>
      <div><span>{label}</span><Icon size={18} aria-hidden="true" /></div>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

function DailySalesChart({ values }) {
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, values.findLastIndex(({ amount }) => amount > 0)));
  const bars = useRef(null);
  const selected = values[selectedIndex];
  const maxAmount = Math.max(0.04, ...values.map(({ amount }) => amount));
  const magnitude = 10 ** Math.floor(Math.log10(maxAmount / 4));
  const step = [1, 2, 2.5, 5, 10].find((size) => size * magnitude >= maxAmount / 4) * magnitude;
  const ticks = Array.from({ length: 5 }, (_, index) => (4 - index) * step);
  const labelIndexes = values.length <= 7
    ? values.map((_, index) => index)
    : Array.from({ length: 5 }, (_, index) => Math.round(index * (values.length - 1) / 4));

  function moveFocus(event, index) {
    const destinations = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: values.length - 1 };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    bars.current?.children[Math.max(0, Math.min(values.length - 1, destinations[event.key]))]?.focus();
  }

  return (
    <>
      <div className="apo-super-sales-readout">
        <time dateTime={dayKey.format(selected.date)}>{dayLabel.format(selected.date)}</time>
        <strong>{currency.format(selected.amount)}</strong>
      </div>
      <div className="apo-super-sales-chart" style={{ "--sales-days": values.length }}>
        <div className="apo-super-sales-scale" aria-hidden="true">
          {ticks.map((value, index) => <span key={index} style={{ top: `${index * 25}%` }}>{axisCurrency.format(value)}</span>)}
        </div>
        <div className="apo-super-sales-plot">
          <div className="apo-super-sales-guides" aria-hidden="true">
            {ticks.map((_, index) => <i key={index} style={{ top: `${index * 25}%` }} />)}
          </div>
          <div className="apo-super-sales-bars" ref={bars} role="group" aria-label="Daily verified payments">
            {values.map(({ date, amount }, index) => (
              <button
                key={dayKey.format(date)}
                type="button"
                className={`apo-super-sales-day${index === selectedIndex ? " is-selected" : ""}${amount === 0 ? " is-zero" : ""}`}
                aria-label={`${dayLabel.format(date)}, ${currency.format(amount)} in verified payments`}
                aria-pressed={index === selectedIndex}
                tabIndex={index === selectedIndex ? 0 : -1}
                onPointerEnter={() => setSelectedIndex(index)}
                onFocus={() => setSelectedIndex(index)}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(event) => moveFocus(event, index)}
              >
                <span aria-hidden="true" style={{ height: `${amount / ticks[0] * 100}%` }} />
              </button>
            ))}
          </div>
        </div>
        <div className="apo-super-chart-dates" aria-hidden="true">
          {labelIndexes.map((index, position) => (
            <span key={index} className={values.length <= 7 && position % 2 === 1 ? "is-secondary" : undefined} style={{ gridColumn: index + 1 }}>
              {dayLabel.format(values[index].date)}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function SalesTrend({ sales, loading }) {
  return (
    <section className="apo-super-panel apo-super-sales-panel">
      <header><h2>Sales trend</h2><p>Verified payments by day</p></header>
      {loading ? <p className="apo-super-empty" role="status">Loading sales.</p>
        : !sales ? <p className="apo-super-empty" role="status">Sales totals are unavailable for this period.</p>
          : sales.total === 0 ? <p className="apo-super-empty">No verified payments in this period.</p>
            : <DailySalesChart key={`${dayKey.format(sales.days[0].date)}-${sales.days.length}`} values={sales.days} />}
    </section>
  );
}

export function OrderBreakdown({ statuses, total, loading }) {
  let start = 0;
  const segments = statuses?.map(({ count, color }) => {
    const end = start + (total ? count / total * 100 : 0);
    const segment = `${color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return (
    <section className="apo-super-panel apo-super-order-panel">
      <header><h2>Order status</h2><p>Current status of orders placed in this period</p></header>
      {loading ? <p className="apo-super-empty" role="status">Loading order status.</p>
        : !statuses ? <p className="apo-super-empty" role="status">Order status totals are unavailable.</p> : (
          <div className="apo-super-breakdown">
            <div className="apo-super-donut" role="img" aria-label={`${number.format(total)} total orders`} style={total ? { background: `conic-gradient(${segments.join(", ")})` } : undefined}>
              <div><strong>{number.format(total)}</strong><small>Orders</small></div>
            </div>
            <ul aria-label="Order status breakdown">{statuses.map(({ label, color, count }) => (
              <li key={label}>
                <i aria-hidden="true" style={{ backgroundColor: color }} />
                <span>{label}</span>
                <strong>{number.format(count)}</strong>
                <small>{percentage.format(total ? count / total : 0)}</small>
              </li>
            ))}</ul>
          </div>
        )}
    </section>
  );
}

function getSales(result, range) {
  const payments = getVerifiedPayments(result, range);
  if (!payments) return null;
  const totals = new Map();
  const orderIds = new Set();
  let total = 0;
  for (const { date, amount, orderId } of payments) {
    const key = dayKey.format(date);
    total += amount;
    totals.set(key, (totals.get(key) || 0) + amount);
    if (orderId != null) orderIds.add(orderId);
  }
  return { total, orderIds: [...orderIds], days: range.dates.map((date) => ({ date, amount: totals.get(dayKey.format(date)) || 0 })) };
}

async function loadTopProducts(sales) {
  if (!sales) return null;
  if (!sales.orderIds.length) return [];
  const { data, count, error } = await supabase.from("order_items")
    .select("product_id, product_name, quantity, orders!inner(order_status)", { count: "exact" })
    .in("order_id", sales.orderIds)
    .in("orders.order_status", ["confirmed", "processing", "ready_for_pickup", "out_for_delivery", "completed"])
    .limit(1000);
  if (error || !data || count !== data.length) return null;
  const byProduct = new Map();
  for (const item of data) {
    const key = item.product_id ?? item.product_name;
    const product = byProduct.get(key);
    byProduct.set(key, { key, name: item.product_name, quantity: (product?.quantity || 0) + Number(item.quantity) });
  }
  return [...byProduct.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5);
}

export default function SuperAdminOverview() {
  const [days, setDays] = useState(7);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const data = result?.days === days && result?.refresh === refresh ? result : null;
  const loading = data === null;

  useEffect(() => {
    let active = true;
    async function load() {
      const range = getManilaRange(days);
      const orderPeriod = () => supabase.from("orders")
        .select("id, order_status, total, created_at", { count: "exact" })
        .gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString());
      const [payments, recent, visits, team, statusTotals] = await Promise.all([
        supabase.rpc("get_order_payment_records"),
        orderPeriod().order("created_at", { ascending: false }).order("id", { ascending: false }).limit(5),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("status", "completed").gte("appointment_date", dayKey.format(range.start)).lt("appointment_date", dayKey.format(range.end)),
        supabase.from("staff_profiles").select("user_id", { count: "exact", head: true }).eq("employment_status", "active"),
        Promise.all(ORDER_STATUS_GROUPS.map(({ values }) => orderPeriod().in("order_status", values).limit(1))),
      ]);
      if (!active) return;
      const sales = getSales(payments, range);
      const topProducts = await loadTopProducts(sales).catch(() => null);
      if (!active) return;
      const orderStatuses = statusTotals.every(({ error, count }) => !error && count != null)
        ? ORDER_STATUS_GROUPS.map((group, index) => ({ ...group, count: statusTotals[index].count }))
        : null;
      setResult({ days, refresh, range, sales, topProducts,
        recent: recent.error ? null : recent.data || [], orders: recent.error ? null : recent.count,
        exams: visits.error ? null : visits.count, team: team.error ? null : team.count, orderStatuses });
    }
    load().catch(() => {
      if (active) setResult({ days, refresh });
    });
    return () => { active = false; };
  }, [days, refresh]);

  const countsAvailable = data?.orderStatuses && data.orders != null;
  const knownTotal = data?.orderStatuses?.reduce((sum, { count }) => sum + count, 0);
  const statuses = countsAvailable && knownTotal <= data.orders
    ? [...data.orderStatuses, ...(knownTotal < data.orders ? [{ label: "Other", color: "#8a827a", count: data.orders - knownTotal }] : [])] : null;
  const formatCount = (value) => value == null ? "—" : number.format(value);
  return (
    <div className="apo-super-overview">
      <header className="apo-super-header">
        <div><h1>Overview</h1><p>Track sales, clinic visits, and orders across Acebedo Panol Optical.</p></div>
        <div className="apo-super-controls">
          <label>Period <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
          </select></label>
          <button type="button" aria-label="Refresh overview" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} aria-hidden="true" /></button>
        </div>
      </header>
      {data?.range && <p className="apo-super-period">{dayLabel.format(data.range.start)} – {dayLabel.format(data.range.dates.at(-1))} · Philippine time</p>}
      <section className="apo-super-metrics" aria-label="Overview metrics" aria-busy={loading}>
        <Metric label="Verified payments" value={data?.sales ? currency.format(data.sales.total) : "—"} description={loading || data?.sales ? "Payments collected" : "Payment totals unavailable"} icon={Banknote} featured />
        <Metric label="Orders placed" value={formatCount(data?.orders)} description="All orders in this period" icon={ShoppingBag} />
        <Metric label="Completed eye exams" value={formatCount(data?.exams)} description="Visits marked completed" icon={CalendarCheck} />
        <Metric label="Active team" value={formatCount(data?.team)} description="Current staff accounts" icon={Users} />
      </section>
      <div className="apo-super-columns">
        <SalesTrend sales={data?.sales} loading={loading} />
        <OrderBreakdown statuses={statuses} total={data?.orders} loading={loading} />
      </div>
      <div className="apo-super-columns">
      <section className="apo-super-panel apo-super-recent">
        <header><div><h2>Recent orders</h2><p>Latest orders in this period</p></div><Link to="/admin/orders">View orders <ArrowUpRight size={14} aria-hidden="true" /></Link></header>
        {loading ? <p className="apo-super-empty" role="status">Loading recent orders.</p>
          : !data.recent ? <p className="apo-super-empty" role="status">Recent orders are unavailable.</p>
            : data.recent.length === 0 ? <p className="apo-super-empty">No orders in this period.</p> : (
              <div className="apo-super-table-wrap">
                <table className="apo-super-table">
                  <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Total</th></tr></thead>
                  <tbody>{data.recent.map((order) => (
                    <tr key={order.id}>
                      <th scope="row"><Link to={`/admin/orders/${order.id}`}>#APO-{order.id}</Link></th>
                      <td>{dayLabel.format(new Date(order.created_at))}</td>
                      <td className="apo-super-order-status">{order.order_status?.replaceAll("_", " ") || "Unknown"}</td>
                      <td>{currency.format(order.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
      </section>
      <section className="apo-super-panel">
        <header><h2>Top-selling products</h2><p>Ranked by units on paid orders in this period</p></header>
        {loading ? <p className="apo-super-empty" role="status">Loading products.</p>
          : !data.topProducts ? <p className="apo-super-empty" role="status">Product totals are unavailable for this period.</p>
            : data.topProducts.length === 0 ? <p className="apo-super-empty">No products sold in this period.</p> : (
              <ol className="apo-super-top-products">
                {data.topProducts.map(({ key, name, quantity }) => <li key={key}><span>{name}</span><strong>{number.format(quantity)} {quantity === 1 ? "unit" : "units"}</strong></li>)}
              </ol>
            )}
      </section>
      </div>
    </div>
  );
}
