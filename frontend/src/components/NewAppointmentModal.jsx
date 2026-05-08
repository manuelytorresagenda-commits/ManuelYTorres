import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createAppointment, fetchServices, fetchAppointments } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { X } from "lucide-react";

function timeToMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTime(m) {
  const h = Math.floor(m / 60); const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function NewAppointmentModal({
  open,
  onClose,
  onCreated,
  specialists = [],
  specialistId: initialSpecialistId,
  startTime: initialStartTime,
  date: initialDate,
}) {
  const { branch } = useAuth();
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [specialistId, setSpecialistId] = useState(initialSpecialistId || "");
  const [serviceId, setServiceId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(initialStartTime || "");
  const [isOverbooked, setIsOverbooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when opened with new props
  useEffect(() => {
    if (open) {
      setSpecialistId(initialSpecialistId || "");
      setStartTime(initialStartTime || "");
      setDate(initialDate || new Date().toISOString().slice(0, 10));
      setServiceId("");
      setClientName("");
      setClientPhone("");
      setIsOverbooked(false);
    }
  }, [open, initialSpecialistId, initialStartTime, initialDate]);

  useEffect(() => {
    if (!open || !branch) return;
    fetchServices({ branch_id: branch.id }).then(setServices).catch(() => toast.error("Error cargando servicios"));
  }, [open, branch]);

  useEffect(() => {
    if (open && specialistId && date && branch) {
      fetchAppointments({ date, branch_id: branch.id }).then((a) =>
        setAppointments(a.filter((x) => x.specialist_id === specialistId))
      );
    } else {
      setAppointments([]);
    }
  }, [open, specialistId, date, branch]);

  const sp = specialists.find((s) => s.id === specialistId);
  const sv = services.find((s) => s.id === serviceId);

  const slots = useMemo(() => {
    if (!sp || !sv) return [];
    const start = timeToMin(sp.start_time);
    const end = timeToMin(sp.end_time);
    const dur = sv.duration_minutes;
    const out = [];
    for (let t = start; t + dur <= end; t += 30) {
      const slotStart = t;
      const slotEnd = t + dur;
      const conflict = !isOverbooked && appointments.some((a) => {
        const aS = timeToMin(a.start_time);
        const aE = timeToMin(a.end_time);
        return slotStart < aE && aS < slotEnd;
      });
      out.push({ time: minToTime(slotStart), conflict });
    }
    return out;
  }, [sp, sv, appointments, isOverbooked]);

  const submit = async (e) => {
    e.preventDefault();
    if (!specialistId || !serviceId || !clientName || !date || !startTime) {
      toast.error("Complete todos los campos");
      return;
    }
    setSubmitting(true);
    try {
      await createAppointment({
        specialist_id: specialistId,
        service_id: serviceId,
        client_name: clientName,
        client_phone: clientPhone,
        date,
        start_time: startTime,
        is_overbooked: isOverbooked,
      });
      toast.success(isOverbooked ? "Cita extra registrada" : "Cita registrada");
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo crear la cita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="new-appointment-modal"
        className="max-w-2xl bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Nueva Cita</DialogTitle>
        <DialogDescription className="sr-only">
          Formulario para registrar una nueva cita: seleccione especialista, servicio, cliente, fecha y hora.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b border-black">
          <div>
            <div className="font-mono-label text-[10px] text-neutral-500">REGISTRO</div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none">
              Nueva <em className="italic">Cita</em>
            </div>
          </div>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Specialist (read-only when preselected) */}
          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              ESPECIALISTA
            </label>
            <select
              data-testid="modal-specialist-select"
              value={specialistId}
              onChange={(e) => { setSpecialistId(e.target.value); setStartTime(""); setServiceId(""); }}
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
            >
              <option value="">— Seleccionar —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.specialty}</option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              SERVICIO
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`modal-service-${s.id}`}
                  onClick={() => { setServiceId(s.id); }}
                  className={`btn-invert border p-3 text-left ${
                    serviceId === s.id ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                  }`}
                >
                  <div className="font-serif-display text-base leading-tight">{s.name}</div>
                  <div className="font-mono-label text-[9px] opacity-60 mt-1">
                    {s.duration_minutes} MIN · ${s.cost}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">CLIENTE</label>
            <input
              data-testid="modal-client-name-input"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-serif-display text-lg"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              TELÉFONO <span className="opacity-60">(opcional)</span>
            </label>
            <input
              data-testid="modal-client-phone-input"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ej. 55 1234 5678"
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
            />
          </div>

          {/* Date + Hour */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">FECHA</label>
              <input
                data-testid="modal-date-input"
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
              />
            </div>
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
                HORA INICIO
              </label>
              <input
                data-testid="modal-start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
              />
            </div>
          </div>

          {/* Slots suggestion */}
          {sp && sv && (
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
                HORARIOS DISPONIBLES (sugeridos)
              </label>
              {slots.length === 0 ? (
                <div className="text-xs text-neutral-500 border border-dashed border-neutral-300 p-4">
                  No hay turnos disponibles.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto" data-testid="modal-slots-grid">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      data-testid={`modal-slot-${s.time}`}
                      disabled={s.conflict}
                      onClick={() => setStartTime(s.time)}
                      className={`btn-invert border py-2 px-2 font-mono-label text-[10px] ${
                        s.conflict
                          ? "border-neutral-200 text-neutral-300 line-through cursor-not-allowed"
                          : startTime === s.time
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 hover:border-black"
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cita Extra toggle */}
          <label
            data-testid="overbooked-toggle"
            className={`flex items-center justify-between gap-4 border p-3 cursor-pointer btn-invert ${
              isOverbooked ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
            }`}
          >
            <div>
              <div className="font-mono-label text-[10px]">CITA EXTRA (SOBRECUPO)</div>
              <div className="text-[11px] opacity-70 mt-1">
                Permite agendar aunque el horario ya esté ocupado.
              </div>
            </div>
            <input
              type="checkbox"
              data-testid="overbooked-checkbox"
              checked={isOverbooked}
              onChange={(e) => setIsOverbooked(e.target.checked)}
              className="w-5 h-5 accent-black cursor-pointer"
            />
          </label>

          {/* Summary */}
          {sv && startTime && (
            <div className="border border-black p-4 bg-neutral-50" data-testid="modal-summary">
              <div className="font-mono-label text-[9px] text-neutral-500 mb-2">RESUMEN</div>
              <div className="text-sm">
                <strong>{startTime}</strong> — {minToTime(timeToMin(startTime) + sv.duration_minutes)}
              </div>
              <div className="text-xs text-neutral-600 mt-1">{sv.name} · {sp?.name}</div>
              <div className="text-xs text-neutral-600">Costo: ${sv.cost}</div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="modal-cancel-btn"
              className="btn-invert flex-1 border border-black bg-white text-black py-3 font-mono-label text-[10px] hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="modal-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border border-black bg-black text-white py-3 font-mono-label text-[10px] hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting ? "REGISTRANDO..." : "CONFIRMAR CITA"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
