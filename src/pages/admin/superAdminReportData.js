export const manilaDayKey = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "Asia/Manila" });

export const ORDER_STATUS_GROUPS = [
  { label: "Awaiting payment", values: ["pending"], color: "#d8a75d" },
  { label: "In progress", values: ["confirmed", "processing", "ready_for_pickup", "out_for_delivery"], color: "#527b97" },
  { label: "Completed", values: ["completed"], color: "#397862" },
  { label: "Cancelled", values: ["cancelled"], color: "#ad5262" },
  { label: "Manual review", values: ["manual_review"], color: "#816b94" },
];

const DAY_MS = 86_400_000;

function manilaMidnight(key) {
  return new Date(`${key}T00:00:00+08:00`);
}

export function getReportRange(period, month, year, now = new Date()) {
  const todayKey = manilaDayKey.format(now);
  const today = manilaMidnight(todayKey);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  let start = today;
  let end = tomorrow;

  if (period === "week") {
    const daysSinceMonday = (new Date(`${todayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
    start = new Date(today.getTime() - daysSinceMonday * DAY_MS);
  } else if (period === "month") {
    start = manilaMidnight(`${todayKey.slice(0, 7)}-01`);
  } else if (period === "specific-month") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith("0000") || month > todayKey.slice(0, 7)) return null;
    start = manilaMidnight(`${month}-01`);
    // From a first-of-month date, 32 days later is always in the next month.
    const nextMonth = manilaDayKey.format(new Date(start.getTime() + 32 * DAY_MS)).slice(0, 7);
    const nextMonthStart = manilaMidnight(`${nextMonth}-01`);
    end = nextMonthStart < tomorrow ? nextMonthStart : tomorrow;
  } else if (period === "year") {
    const currentYear = Number(todayKey.slice(0, 4));
    const reportYear = Number(year);
    if (!Number.isInteger(reportYear) || reportYear < 1 || reportYear > currentYear) return null;
    start = manilaMidnight(`${String(reportYear).padStart(4, "0")}-01-01`);
    if (reportYear < currentYear) end = manilaMidnight(`${String(reportYear + 1).padStart(4, "0")}-01-01`);
  }

  return {
    start,
    end,
    startKey: manilaDayKey.format(start),
    endKey: manilaDayKey.format(end),
    lastDate: new Date(end.getTime() - DAY_MS),
    byMonth: period === "year",
  };
}

export function getVerifiedPayments(result, { start, end }) {
  // The existing payment RPC returns at most 500 records.
  if (result.error || !Array.isArray(result.data) || result.data.length >= 500) return null;
  const payments = [];
  for (const row of result.data) {
    if (row.status !== "paid" || row.currency !== "PHP" || !row.paid_at) continue;
    const date = new Date(row.paid_at);
    if (!Number.isFinite(date.getTime()) || date < start || date >= end) continue;
    const amount = Number(row.amount);
    if (row.amount == null || !Number.isFinite(amount)) return null;
    payments.push({ date, amount, orderId: row.order_id });
  }
  return payments;
}

export function summarizeReport(range, { payments, orders, exams }) {
  const keyForDay = (day) => range.byMonth ? day.slice(0, 7) : day;
  const rows = new Map();
  for (let day = range.start.getTime(); day < range.end.getTime(); day += DAY_MS) {
    const date = new Date(day);
    const key = keyForDay(manilaDayKey.format(date));
    if (!rows.has(key)) rows.set(key, { key, date, payment: payments ? 0 : null, orders: orders ? 0 : null, exams: exams ? 0 : null });
  }

  let totalCents = 0;
  for (const { date, amount } of payments || []) {
    const cents = Math.round(amount * 100);
    rows.get(keyForDay(manilaDayKey.format(date))).payment += cents;
    totalCents += cents;
  }

  const statuses = orders ? ORDER_STATUS_GROUPS.map((group) => ({ ...group, count: 0 })) : null;
  const other = { label: "Other", color: "#8a827a", count: 0 };
  for (const order of orders || []) {
    rows.get(keyForDay(manilaDayKey.format(new Date(order.created_at)))).orders += 1;
    const status = statuses.find((group) => group.values.includes(order.order_status)) || other;
    status.count += 1;
  }
  if (other.count) statuses.push(other);

  for (const exam of exams || []) rows.get(keyForDay(exam.appointment_date)).exams += 1;

  return {
    rows: [...rows.values()].map((row) => ({ ...row, payment: row.payment == null ? null : row.payment / 100 })),
    payment: payments ? totalCents / 100 : null,
    orders: orders?.length ?? null,
    exams: exams?.length ?? null,
    statuses,
  };
}
