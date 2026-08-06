import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import {
  fetchSpecialists,
  fetchServices,
  fetchAppointments,
  rescheduleAppointment,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { X, CalendarClock, ArrowRight, MessageCircle } from "lucide-react";
import { SLOTS, timeToMin, minToTime } from "../lib/scheduling";
import { openRescheduleWhatsapp } from "../lib/whatsapp";

/**
 * Reschedule modal.
 * Props:
 *   - open: bool
 *   - onClose(): closes
 *   - appointment: the appointment to move
 *   - onDone(): called after a successful reschedule (parent should refetch)
 */
export default function RescheduleModal({ open, onClose, appointment, onDone }) {
  const { branch } = useAuth();
  const [specialists, setSpecialists] = useState([]);
  const [services, setServices] = useState([]);
  const [dayAppts, setDayAppts] = useState([]);
  const [specialistId, setSpecialistId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Reset every time the modal opens with a new appointment.
  useEffect(() => {
    if (open && appointment) {
      setSpecialistId(appointment.specialist_id);
      setDate(appointment.date);
      setStartTime(appointment.start_time);
      setNotifyWhatsapp(true);
    }
  }, [open, appointment]);

  // Load specialists + services from the active branch.
  useEffect(() => {
    if (!open || !branch) return;
    fetchSpecialists({ branch_id: branch.id })
      .then(setSpecialists)
      .catch(() => setSpecialists([]));
    fetchServices({ branch_id: branch.id })
      .then(setServices)
      .catch(() => setServices([]));
  }, [open, branch]);

  // Load appointments for the chosen day (to compute conflicts).
  useEffect(() => {
    if (!open || !date) return;
    fetchAppointments({ date, branch_id: branch?.id })
      .then((d) => setDayAppts(Array.isArray(d) ? d : []))
      .catch(() => setDayAppts([]));
  }, [open, date, branch, specialistId]);

  const selectedSp = useMemo(
    () => specialists.find((s) => s.id === specialistId),
    [specialists, specialistId]
  );

  // Duration preserved from the current appointment.
  const durationMin = useMemo(() => {
    if (!appointment) return 30;
    const s = timeToMin(appointment.start_time);
    const e = timeToMin(appointment.end_time);
    return Math.max(30, e - s);
  }, [appointment]);

  // Conflict set: minutes ranges [start,end) of NORMAL appointments (non
  // floating / non overbooked) for the chosen specialist that day, excluding
  // the appointment being moved.
  const conflictRanges = useMemo(() => {
    if (!specialistId || !appointment) return [];
    return dayAppts
      .filter((a) =>
        a.specialist_id === specialistId &&
        a.id !== appointment.id &&
        !a.is_overbooked &&
        !a.is_floating
      )
      .map((a) => [timeToMin(a.start_time), timeToMin(a.end_time)]);
  }, [dayAppts, specialistId, appointment]);

  const isOverbookedOrFloating =
    appointment && (appointment.is_overbooked || appointment.is_floating);

  // Slots inside the specialist's shift only (and reject if new range would
  // extend past shift end).
  const slotStates = useMemo(() => {
    const map = new Map();
    if (!selectedSp) return map;
    const shiftStart = timeToMin(selectedSp.start_time);
    const shiftEnd = timeToMin(selectedSp.end_time);
    for (const slot of SLOTS) {
      const start = slot;
      const end = slot + durationMin;
      const outOfShift = start < shiftStart || end > shiftEnd;
      let conflict = false;
      // Floating/overbooked appts do not care about conflicts.
      if (!isOverbookedOrFloating) {
        for (const [cs, ce] of conflictRanges) {
          if (start < ce && cs < end) { conflict = true; break; }
        }
      }
      map.set(slot, { outOfShift, conflict });
    }
    return map;
  }, [selectedSp, durationMin, conflictRanges, isOverbookedOrFloating]);

  const canSubmit =
    !!specialistId &&
    !!date &&
    !!startTime &&
    !submitting &&
    (() => {
      const s = slotStates.get(timeToMin(startTime));
      if (!s) return false;
      if (s.outOfShift) return false;
      if (s.conflict) return false;
      return true;
    })();

  const submit = async () => {
    if (!canSubmit || !appointment) return;
    setSubmitting(true);
    try {
      const updated = await rescheduleAppointment(appointment.id, {
        specialist_id: specialistId,
        date,
        start_time: startTime,
      });
      toast.success("Cita reagendada");

      // Auto-open WhatsApp with the new-details message when enabled.
      const phoneDigits = (appointment.client_phone || "").replace(/\D/g, "");
      if (notifyWhatsapp && phoneDigits.length >= 8) {
        const newSp = specialists.find((s) => s.id === specialistId);
        const svName = appointment.is_floating
          ? appointment.custom_service_name
          : (services.find((s) => s.id === appointment.service_id)?.name || "");
        const opened = openRescheduleWhatsapp({
          clientName: appointment.client_name,
          clientPhone: appointment.client_phone,
          date,
          startTime,
          endTime: updated?.end_time,
          serviceName: svName,
          specialistName: newSp?.name,
          branchName: branch?.name,
          previousDate: appointment.date,
          previousStartTime: appointment.start_time,
          previousEndTime: appointment.end_time,
        });
        if (opened) {
          toast.info("Abriendo WhatsApp para avisar a la cliente\u2026");
        } else {
          toast.error("WhatsApp bloqueado por el navegador. Permita ventanas emergentes.");
        }
      }

      onDone && onDone();
      onClose && onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  const originalLabel = `${appointment.date} · ${appointment.start_time} - ${appointment.end_time}`;
  const newEnd = startTime
    ? minToTime(timeToMin(startTime) + durationMin)
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="reschedule-modal"
        className="max-w-3xl bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden max-h-[90vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">Reagendar cita</DialogTitle>
        <DialogDescription className="sr-only">
          Mover la cita a otro horario o especialista.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-black">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-mono-label text-[10px] text-neutral-500">REAGENDAR CITA</span>
            </div>
            <div className="font-serif-display text-3xl leading-none">
              {appointment.client_name}
            </div>
            <div className="font-mono-label text-[10px] text-neutral-500 mt-2 flex items-center gap-2">
              <span>DE:</span>
              <span className="text-black">{originalLabel}</span>
              {startTime && (
                <>
                  <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                  <span className="text-black">
                    {date} · {startTime} - {newEnd}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            data-testid="reschedule-close"
            onClick={onClose}
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Specialist + date */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
                ESPECIALISTA
              </label>
              <select
                data-testid="reschedule-specialist-select"
                value={specialistId}
                onChange={(e) => setSpecialistId(e.target.value)}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-serif-display text-lg"
              >
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.specialty}
                  </option>
                ))}
              </select>
              {selectedSp && (
                <div className="font-mono-label text-[9px] text-neutral-500 mt-2">
                  TURNO: {selectedSp.start_time} — {selectedSp.end_time}
                </div>
              )}
            </div>
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
                FECHA
              </label>
              <input
                type="date"
                data-testid="reschedule-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
              />
              <div className="font-mono-label text-[9px] text-neutral-500 mt-2">
                DURACIÓN FIJA: {durationMin} MIN
              </div>
            </div>
          </div>

          {/* Slots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono-label text-[10px] text-neutral-500">
                HORARIOS DISPONIBLES
              </div>
              <div className="font-mono-label text-[9px] text-neutral-500 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border border-black bg-white" />
                  LIBRE
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-black" />
                  SELECCIONADO
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-neutral-200 border border-neutral-300" />
                  OCUPADO / FUERA DE TURNO
                </span>
              </div>
            </div>
            {isOverbookedOrFloating && (
              <div className="border border-dashed border-sky-500 bg-sky-50 text-xs px-4 py-2 mb-3 font-mono-label">
                Esta cita es EXTRA / FLOTANTE — puede sobreponerse a cualquier horario.
              </div>
            )}
            <div
              data-testid="reschedule-slot-grid"
              className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2"
            >
              {SLOTS.map((slot) => {
                const label = minToTime(slot);
                const st = slotStates.get(slot) || { outOfShift: true, conflict: false };
                const disabled = st.outOfShift || st.conflict;
                const isSelected = startTime === label;
                let cls = "border border-black bg-white text-black hover:bg-black hover:text-white";
                if (isSelected) cls = "border border-black bg-black text-white";
                else if (disabled) cls = "border border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed line-through";
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={disabled}
                    data-testid={`reschedule-slot-${label}`}
                    onClick={() => setStartTime(label)}
                    className={`${cls} font-mono-label text-[11px] py-3 btn-invert`}
                    title={
                      st.outOfShift
                        ? "Fuera del turno del especialista"
                        : st.conflict
                        ? "Choque con otra cita normal"
                        : "Libre"
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* WhatsApp notification toggle */}
          {(() => {
            const hasPhone = (appointment.client_phone || "").replace(/\D/g, "").length >= 8;
            return (
              <label
                data-testid="reschedule-notify-toggle"
                className={`flex items-center justify-between gap-4 border p-3 cursor-pointer btn-invert ${
                  notifyWhatsapp && hasPhone ? "border-black bg-emerald-50" : "border-neutral-300 hover:border-black"
                }`}
              >
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <div className="font-mono-label text-[10px]">AVISAR POR WHATSAPP</div>
                    <div className="text-[11px] opacity-70 mt-1">
                      {hasPhone
                        ? "Se abrir\u00e1 WhatsApp con el mensaje: \"Tu cita fue reagendada con \u00e9xito\" + nuevos detalles."
                        : "La cita no tiene tel\u00e9fono registrado."}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  data-testid="reschedule-notify-checkbox"
                  checked={notifyWhatsapp && hasPhone}
                  disabled={!hasPhone}
                  onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                  className="w-5 h-5 accent-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
              </label>
            );
          })()}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              data-testid="reschedule-cancel-btn"
              className="btn-invert border border-black px-6 py-3 font-mono-label text-[10px] hover:bg-black hover:text-white"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              data-testid="reschedule-submit-btn"
              className="btn-invert border border-black bg-black text-white px-6 py-3 font-mono-label text-[10px] hover:bg-white hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "REAGENDANDO…" : "CONFIRMAR REAGENDA"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
