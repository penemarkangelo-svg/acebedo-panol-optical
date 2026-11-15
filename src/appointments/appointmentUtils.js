export const APPOINTMENT_TYPE = "Eye Examination";

export function toLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatAppointmentDate(value, options = {}) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatAppointmentTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function getAppointmentReference(appointment) {
  if (!appointment?.id || !appointment?.appointment_date) return "";
  const date = new Date(`${appointment.appointment_date}T00:00:00`);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `AP-${year}${month}${day}-${String(appointment.id).padStart(3, "0")}`;
}

export function getScreeningReference(screening) {
  if (!screening?.id || !screening?.created_at) return "";
  const date = new Date(screening.created_at);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `VS-${year}${month}${day}-${String(screening.id).padStart(3, "0")}`;
}

export function getStatusLabel(status) {
  return String(status || "pending").replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function formatMonth(value) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

export function formatScreeningDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
