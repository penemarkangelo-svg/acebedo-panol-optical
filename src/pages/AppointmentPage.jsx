import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { APPOINTMENT_TYPE, formatAppointmentDate, formatAppointmentTime, formatMonth, formatScreeningDate, getCalendarCells, getScreeningReference, toLocalDateKey } from "../appointments/appointmentUtils";
import "../styles/AppointmentPage.css";

const today = new Date();
const month = new Date(today.getFullYear(), today.getMonth(), 1);
const cells = getCalendarCells(month);

export default function AppointmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState("");
  const [screening, setScreening] = useState(null);
  const [includeScreening, setIncludeScreening] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSlots() {
      setLoading(true);
      setError("");
      setSelectedSlot(null);
      const first = toLocalDateKey(month);
      const last = toLocalDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
      const { data, error: queryError } = await supabase
        .from("appointment_slots")
        .select("id, slot_date, start_time, end_time, capacity, booked_count, status")
        .eq("status", "available")
        .gte("slot_date", first)
        .lte("slot_date", last)
        .order("slot_date")
        .order("start_time");

      if (!active) return;
      if (queryError) {
        setError("We couldn’t load available appointment times. Please try again.");
        setSlots([]);
      } else {
        const now = new Date();
        const available = (data || []).filter((slot) => {
          if (slot.booked_count >= slot.capacity) return false;
          const slotDate = new Date(`${slot.slot_date}T${slot.start_time}`);
          return slotDate.getTime() > now.getTime();
        });
        setSlots(available);
        setSelectedDate((current) => available.some((slot) => slot.slot_date === current) ? current : "");
      }
      setLoading(false);
    }
    loadSlots();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCurrentScreening() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("vision_screening_results")
        .select("id, created_at, status")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) {
        setScreening(data || null);
        setIncludeScreening(Boolean(data));
      }
    }
    loadCurrentScreening();
    return () => { active = false; };
  }, [user?.id]);

  const slotsByDate = useMemo(() => slots.reduce((grouped, slot) => {
    (grouped[slot.slot_date] ||= []).push(slot);
    return grouped;
  }, {}), [slots]);
  const selectedDateLabel = selectedDate ? formatAppointmentDate(selectedDate) : "Choose a date";

  const handleBook = async () => {
    if (!selectedSlot || !user?.id) return;
    setSubmitting(true);
    setError("");

    const customerName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Customer";
    const { data: existingActive, error: activeLookupError } = await supabase
      .from("appointments")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "confirmed"])
      .limit(1)
      .maybeSingle();
    if (activeLookupError) {
      setError("We couldn’t verify your current appointments. Please try again.");
      setSubmitting(false);
      return;
    }
    if (existingActive) {
      setError("You already have an active appointment. Visit Appointments to review it.");
      setSubmitting(false);
      return;
    }

    const { data, error: bookingError } = await supabase.rpc("book_appointment", {
      p_slot_id: selectedSlot.id,
      p_customer_name: customerName,
      p_email: user.email || null,
      p_contact_number: user.user_metadata?.phone || null,
      p_notes: null,
    });

    if (bookingError) {
      setError(bookingError.message || "This time is no longer available. Please choose another slot.");
      setSubmitting(false);
      return;
    }

    navigate(`/appointments/confirmation/${data}`, {
      state: {
        notes: notes.trim(),
        includeScreening,
        slotDate: selectedSlot.slot_date,
        slotTime: selectedSlot.start_time,
        slotEndTime: selectedSlot.end_time,
      },
    });
    toast.success("Your appointment request was received.");
  };

  return (
    <div className="appointment-page">
      <Header />
      <main className="appointment-main">
        <div className="appointment-intro">
          <p className="appointment-eyebrow">Appointments / Book a visit</p>
          <h1>Book an Appointment</h1>
          <p>Choose a convenient time for your eye examination. Review your details before confirming.</p>
        </div>

        <div className="appointment-layout">
          <div className="appointment-form-column">
            <section className="appointment-section appointment-schedule-section">
              <div className="appointment-section-heading">
                <span className="appointment-step">01</span>
                <h2>Choose your date &amp; time</h2>
              </div>
              <div className="appointment-schedule-grid">
                <div className="appointment-calendar">
                  <div className="appointment-month-row">
                    <h3>{formatMonth(month)}</h3>
                  </div>
                  <div className="appointment-calendar-grid" role="grid" aria-label={formatMonth(month)}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span className="appointment-weekday" key={`${day}-${index}`}>{day}</span>)}
                    {cells.map((day, index) => {
                      if (!day) return <span className="appointment-calendar-empty" key={`empty-${index}`} />;
                      const date = new Date(month.getFullYear(), month.getMonth(), day);
                      const key = toLocalDateKey(date);
                      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                      const hasSlots = Boolean(slotsByDate[key]?.length);
                      const selected = selectedDate === key;
                      return (
                        <button
                          type="button"
                          role="gridcell"
                          aria-selected={selected}
                          key={key}
                          disabled={isPast || !hasSlots}
                          className={`appointment-calendar-day${selected ? " is-selected" : ""}${hasSlots ? " has-slots" : ""}`}
                          onClick={() => { setSelectedDate(key); setSelectedSlot(null); }}
                        >{day}</button>
                      );
                    })}
                  </div>
                  <p className="appointment-today-note"><span /> Today: {formatAppointmentDate(toLocalDateKey(today), { weekday: undefined, year: undefined })}</p>
                </div>

                <div className="appointment-slot-panel">
                  <div className="appointment-selected-date">
                    <h3>{selectedDate ? selectedDateLabel : "Select a date"}</h3>
                    <p>{selectedDate ? `${(slotsByDate[selectedDate] || []).length} available times · Select one` : "Available appointment times"}</p>
                  </div>
                  {loading ? <p className="appointment-inline-message">Loading available times…</p> : null}
                  {!loading && error && !selectedSlot ? <p className="appointment-inline-error">{error}</p> : null}
                  {!loading && selectedDate && !slotsByDate[selectedDate]?.length ? <p className="appointment-inline-message">No available times for this date.</p> : null}
                  {!loading && !selectedDate && !error ? <p className="appointment-inline-message">Select a date with an available time.</p> : null}
                  {selectedDate && slotsByDate[selectedDate]?.length ? (
                    <div className="appointment-time-grid">
                      {slotsByDate[selectedDate].map((slot) => (
                        <button
                          type="button"
                          key={slot.id}
                          className={`appointment-time-option${selectedSlot?.id === slot.id ? " is-selected" : ""}`}
                          onClick={() => setSelectedSlot(slot)}
                        >{formatAppointmentTime(slot.start_time)}</button>
                      ))}
                    </div>
                  ) : null}
                  {selectedSlot ? <p className="appointment-selected-time">✓ &nbsp;{formatAppointmentTime(selectedSlot.start_time)} selected</p> : null}
                  <div className="appointment-type-line"><span className="appointment-eye-dot">◉</span><span><small>Appointment type</small><strong>{APPOINTMENT_TYPE}</strong></span></div>
                </div>
              </div>
            </section>

            <section className="appointment-section appointment-screening-section">
              <div className="appointment-section-heading">
                <span className="appointment-step">02</span>
                <h2>Vision Screening</h2><span className="appointment-optional">Optional</span>
              </div>
              <p className="appointment-section-copy">Show your existing screening result on the confirmation, or book without one. A screening is not a diagnosis.</p>
              <div className="appointment-screening-choices">
                {screening ? (
                  <button type="button" className={`appointment-screening-choice${includeScreening ? " is-current" : ""}`} onClick={() => setIncludeScreening(true)}>
                    <span className="appointment-radio-mark" />
                    <span><strong>Show existing screening result</strong><small>{formatScreeningDate(screening.created_at.slice(0, 10))} · {getScreeningReference(screening)}</small></span>
                  </button>
                ) : (
                  <button type="button" className="appointment-screening-choice" disabled>
                    <span className="appointment-radio-mark" />
                    <span><strong>No screening result yet</strong><small>You can still book an appointment</small></span>
                  </button>
                )}
                <button type="button" className={`appointment-screening-choice${!includeScreening ? " is-current" : ""}`} onClick={() => setIncludeScreening(false)}>
                  <span className="appointment-radio-mark" />
                  <span><strong>Continue without a screening</strong><small>No screening result will be shown</small></span>
                </button>
              </div>
              <p className="appointment-screening-note">Vision screening results are preliminary and are not a diagnosis.</p>
            </section>

            <section className="appointment-section appointment-notes-section">
              <div className="appointment-section-heading">
                <span className="appointment-step">03</span>
                <h2>Additional notes</h2><span className="appointment-optional">Optional</span>
              </div>
              <textarea aria-label="Additional notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="I would like to discuss my current glasses." />
            </section>
          </div>

          <aside className="appointment-summary-card">
            <p className="appointment-eyebrow">Your visit</p>
            <h2>Appointment summary</h2>
            <div className="appointment-summary-divider" />
            <dl>
              <div><dt>Date</dt><dd>{selectedDate ? formatAppointmentDate(selectedDate) : "Select a date"}</dd></div>
              <div><dt>Time</dt><dd>{selectedSlot ? formatAppointmentTime(selectedSlot.start_time) : "Select a time"}</dd></div>
              <div><dt>Appointment type</dt><dd>{APPOINTMENT_TYPE}</dd></div>
              <div><dt>Vision screening</dt><dd>{includeScreening && screening ? "Existing result will be shown" : "No result will be shown"}</dd></div>
            </dl>
            <div className="appointment-summary-divider" />
            <p className="appointment-summary-reminder">Please check your selected date and time before confirming your appointment.</p>
            {error && selectedSlot ? <p className="appointment-inline-error">{error}</p> : null}
            <button className="appointment-primary-button" type="button" onClick={handleBook} disabled={!selectedSlot || submitting}>
              {submitting ? "Booking…" : "Confirm Appointment"}<span aria-hidden="true">→</span>
            </button>
            <Link className="appointment-summary-link" to="/appointments">View Appointments</Link>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
