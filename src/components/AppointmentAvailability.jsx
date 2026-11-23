import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Pencil, RotateCw, X } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";
import { formatAppointmentDate, formatAppointmentTime, formatMonth, getCalendarCells, toLocalDateKey } from "../appointments/appointmentUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthStart(date) {
  return `${date.slice(0, 7)}-01`;
}

function clinicToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key).value).join("-");
}

function hasStarted(slot) {
  return new Date(`${slot.slot_date}T${slot.start_time}+08:00`).getTime() <= Date.now();
}

export default function AppointmentAvailability({ revision, refreshing, onRefresh }) {
  const [date, setDate] = useState(clinicToday);
  const [monthKey, setMonthKey] = useState(() => monthStart(date));
  const [monthResult, setMonthResult] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const today = clinicToday();
  const month = new Date(`${monthKey}T00:00:00`);
  const monthLabel = formatMonth(month);
  const calendarLocked = saving || Boolean(editor);
  const currentMonthResult = monthResult?.monthKey === monthKey && monthResult.revision === revision ? monthResult : null;
  const openDates = new Set(currentMonthResult?.slots
    .filter((slot) => Number(slot.booked_count) < Number(slot.capacity) && !hasStarted(slot))
    .map((slot) => slot.slot_date));

  useEffect(() => {
    let active = true;
    const month = new Date(`${monthKey}T00:00:00`);
    const nextMonth = toLocalDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1));

    async function loadMonth() {
      try {
        const { data, error } = await supabase.from("appointment_slots")
          .select("slot_date, start_time, capacity, booked_count")
          .eq("status", "available").gte("slot_date", monthKey).lt("slot_date", nextMonth);
        if (error) throw error;
        if (active) setMonthResult({ monthKey, revision, slots: data || [] });
      } catch {
        if (active) setMonthResult({ monthKey, revision, error: true });
      }
    }

    loadMonth();
    return () => { active = false; };
  }, [monthKey, revision]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const { data, error } = await supabase.from("appointment_slots")
          .select("id, slot_date, start_time, end_time, capacity, booked_count, status, updated_at")
          .eq("slot_date", date).order("start_time");
        if (error) throw error;
        if (active) setSlots(data || []);
      } catch {
        if (active) {
          setSlots([]);
          setLoadError("Could not load this date. Please retry.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [date, revision]);

  function selectDate(nextDate) {
    if (nextDate !== date) {
      setLoading(true);
      setDate(nextDate);
    }
    setMonthKey(monthStart(nextDate));
  }

  function moveMonth(direction) {
    setMonthKey(toLocalDateKey(new Date(month.getFullYear(), month.getMonth() + direction, 1)));
  }

  const openEditor = (slot) => {
    setSaveError("");
    setEditor(slot ? { ...slot } : {
      slot_date: date, start_time: "", end_time: "", capacity: 1, status: "available", booked_count: 0,
    });
  };
  const change = (key, value) => setEditor((current) => ({ ...current, [key]: value }));

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaveError("");
    const capacity = Number(editor.capacity);
    if (!Number.isInteger(capacity) || capacity < Math.max(1, editor.booked_count)) {
      setSaveError("Capacity must be a whole number and cannot be below the booked count.");
      return;
    }
    if (editor.end_time <= editor.start_time || hasStarted(editor)) {
      setSaveError("Choose a future start time and an end time after the start (Philippine time).");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("save_appointment_slot", {
        p_slot_id: editor.id ?? null,
        p_slot_date: editor.slot_date,
        p_start_time: editor.start_time,
        p_end_time: editor.end_time,
        p_capacity: capacity,
        p_status: editor.status,
        p_expected_updated_at: editor.updated_at ?? null,
      });
      if (error) throw error;
      if (!data) throw new Error("No slot was saved. Refresh availability and try again.");
      selectDate(editor.slot_date);
      setEditor(null);
      toast.success("Availability saved.");
      await onRefresh();
    } catch (error) {
      setSaveError(error.message || "Could not save availability. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="apo-appointments-availability" aria-labelledby="availability-title">
      <div className="apo-appointments-availability-heading">
        <div><h2 id="availability-title">Manage availability</h2><p>Add dates and time slots for customer bookings. All times are Philippine time.</p></div>
        <button type="button" className="apo-appointments-refresh" onClick={onRefresh} disabled={refreshing || loading || saving}><RotateCw size={14} /> Refresh slots</button>
      </div>
      <div className="apo-slot-layout">
        <section className="apo-slot-calendar" aria-label="Availability calendar">
          <div className="apo-slot-calendar-heading">
            <h3 aria-live="polite">{monthLabel}</h3>
            <div className="apo-slot-calendar-actions">
              <button type="button" className="apo-appointments-refresh" disabled={calendarLocked} onClick={() => selectDate(today)}>Today</button>
              <button type="button" className="apo-appointment-close" aria-label="Previous month" disabled={calendarLocked} onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
              <button type="button" className="apo-appointment-close" aria-label="Next month" disabled={calendarLocked} onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="apo-slot-calendar-days">
            {WEEKDAYS.map((weekday) => <span className="apo-slot-weekday" key={weekday} aria-hidden="true">{weekday}</span>)}
            {getCalendarCells(month).map((day, index) => {
              if (!day) return <span key={`empty-${index}`} aria-hidden="true" />;
              const dayKey = `${monthKey.slice(0, 7)}-${String(day).padStart(2, "0")}`;
              const hasOpenSlots = openDates.has(dayKey);
              return (
                <button type="button" className="apo-slot-calendar-day" key={dayKey}
                  aria-label={`${formatAppointmentDate(dayKey)}${hasOpenSlots ? ", open slots" : ""}`}
                  aria-current={dayKey === today ? "date" : undefined}
                  aria-pressed={dayKey === date} disabled={calendarLocked} onClick={() => selectDate(dayKey)}>
                  {day}{hasOpenSlots && <span className="apo-slot-calendar-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="apo-slot-calendar-note" role="status">
            {!currentMonthResult ? "Loading availability..." : currentMonthResult.error
              ? "Could not load availability markers."
              : <><span className="apo-slot-calendar-dot" aria-hidden="true" /> Open slots</>}
          </p>
        </section>
        <section className="apo-slot-day-details" aria-labelledby="apo-slot-date-heading">
          <div className="apo-slot-day-heading">
            <h3 id="apo-slot-date-heading" className="apo-slot-date-heading" aria-live="polite">{formatAppointmentDate(date)}</h3>
            <button type="button" className="apo-slot-primary" onClick={() => openEditor()} disabled={calendarLocked || date < today}><Plus size={15} /> Add slot</button>
          </div>
          {editor && <form className="apo-slot-form" onSubmit={save}>
            <div className="apo-slot-form-heading"><h3>{editor.id ? "Edit time slot" : "New time slot"}</h3><button type="button" className="apo-appointment-close" aria-label="Close slot editor" disabled={saving} onClick={() => setEditor(null)}><X size={16} /></button></div>
            <fieldset disabled={saving}>
              <label>Date<input type="date" required min={clinicToday()} value={editor.slot_date} disabled={editor.booked_count > 0} onChange={(event) => change("slot_date", event.target.value)} /></label>
              <label>Start time<input type="time" required step="60" value={editor.start_time.slice(0, 5)} disabled={editor.booked_count > 0} onChange={(event) => change("start_time", event.target.value)} /></label>
              <label>End time<input type="time" required step="60" value={editor.end_time.slice(0, 5)} disabled={editor.booked_count > 0} onChange={(event) => change("end_time", event.target.value)} /></label>
              <label>Patient capacity<input type="number" required min={Math.max(1, editor.booked_count)} step="1" value={editor.capacity} onChange={(event) => change("capacity", event.target.value)} /></label>
              <label>Availability<select value={editor.status} onChange={(event) => change("status", event.target.value)}><option value="available">Available for booking</option><option value="unavailable">Unavailable</option>{editor.status === "cancelled" && <option value="cancelled" disabled>Cancelled</option>}</select></label>
            </fieldset>
            {editor.booked_count > 0 && <p className="apo-slot-hint">{editor.booked_count} bookings already use this slot. Date and time are locked. Disabling this slot stops new bookings; existing appointments stay scheduled.</p>}
            {saveError && <p className="apo-slot-error" role="alert">{saveError}</p>}
            <div className="apo-slot-form-actions"><button className="apo-appointments-refresh" type="button" disabled={saving} onClick={() => setEditor(null)}>Cancel</button><button className="apo-slot-primary" type="submit" disabled={saving}>{saving && <Loader2 size={15} className="is-spinning" />}{saving ? "Saving..." : "Save slot"}</button></div>
          </form>}
          {loading ? <div className="apo-appointments-availability-empty"><Loader2 size={16} className="is-spinning" /> Loading slots...</div>
            : loadError ? <p className="apo-slot-error" role="alert">{loadError}</p>
              : slots.length === 0 ? <div className="apo-appointments-availability-empty"><CalendarDays size={17} aria-hidden="true" /> No slots for this date.</div>
                : <div className="apo-slot-list">{slots.map((slot) => {
                  const past = hasStarted(slot);
                  const label = past ? "Started / past" : slot.status !== "available" ? slot.status : slot.booked_count >= slot.capacity ? "Full" : "Available";
                  return <article className="apo-slot-row" key={slot.id}>
                    <div><strong>{formatAppointmentTime(slot.start_time)} – {formatAppointmentTime(slot.end_time)}</strong><small>{slot.booked_count} booked / {slot.capacity} capacity</small></div>
                    <span className={`apo-appointment-status ${label === "Available" ? "is-confirmed" : ""}`}>{label}</span>
                    <button className="apo-appointments-view" type="button" disabled={past || saving || !!editor} onClick={() => openEditor(slot)}><Pencil size={14} /> Edit</button>
                  </article>;
                })}</div>}
        </section>
      </div>
      <p className="apo-appointments-schedule-note">Admin and Clinic Staff can manage these slots. Unavailable slots stay saved and can be reopened. Adjacent time windows are allowed; overlapping windows are blocked.</p>
    </section>
  );
}
