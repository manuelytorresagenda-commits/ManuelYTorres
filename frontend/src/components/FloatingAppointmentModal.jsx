import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createAppointment } from "../lib/api";
import { toast } from "sonner";
import { X, Wind } from "lucide-react";

const QUICK_DURATIONS = [15, 30, 45, 60, 90];

export default function FloatingAppointmentModal({
  open,
  onClose,
  onCreated,
  specialists = [],
}) {
  const [specialistId, setSpecialistId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSpecialistId("");
      setClientName("");
      setClientPhone("");
      setServiceName("");
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("");
      setDuration(30);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!specialistId || !clientName || !serviceName || !date || !startTime || !duration) {
      toast.error("Complete todos los campos");
      return;
    }
    setSubmitting(true);
    try {
      await createAppointment({
        specialist_id: specialistId,
        client_name: clientName,
        client_phone: clientPhone,
        date,
        start_time: startTime,
        is_floating: true,
        custom_service_name: serviceName,
        custom_duration_minutes: parseInt(duration),
      });
      toast.success("Cita flotante registrada");
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
        data-testid="floating-appointment-modal"
        className="max-w-lg bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Cita Flotante</DialogTitle>
        <DialogDescription className="sr-only">
          Cita rápida que puede solaparse con horarios ya ocupados.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 border-b border-black bg-sky-50">
          <div>
            <div className="flex items-center gap-2">
              <Wind className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-mono-label text-[10px] text-neutral-500">CITA RÁPIDA</span>
            </div>
            <div className="font-serif-display text-3xl mt-1 leading-none">
              <em className="italic">Flotante</em>
            </div>
            <div className="text-[11px] text-neutral-600 mt-1">
              Permite solapar con citas existentes y rellenar huecos.
            </div>
          </div>
          <button
            type="button"
            data-testid="floating-close-btn"
            onClick={onClose}
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              ESPECIALISTA
            </label>
            <select
              data-testid="floating-specialist-select"
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
            >
              <option value="">— Seleccionar —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.specialty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              SERVICIO / TRABAJO
            </label>
            <input
              data-testid="floating-service-input"
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Ej. Retoque rápido, Cejas, Consulta..."
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-serif-display text-base"
            />
          </div>

          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">CLIENTE</label>
            <input
              data-testid="floating-client-name-input"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-serif-display text-lg"
            />
          </div>

          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              TELÉFONO <span className="opacity-60">(opcional)</span>
            </label>
            <input
              data-testid="floating-client-phone-input"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ej. 55 1234 5678"
              className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">FECHA</label>
              <input
                data-testid="floating-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
              />
            </div>
            <div>
              <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
                HORA INICIO
              </label>
              <input
                data-testid="floating-start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-mono-label text-[9px] text-neutral-500 block mb-2">
              DURACIÓN (MIN)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`floating-duration-${m}`}
                  onClick={() => setDuration(m)}
                  className={`btn-invert border px-4 py-2 font-mono-label text-[10px] ${
                    duration === m
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 hover:border-black"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              data-testid="floating-duration-custom"
              type="number"
              min="5"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              className="w-full border border-black px-4 py-2 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-mono-label text-xs"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="floating-cancel-btn"
              className="btn-invert flex-1 border border-black bg-white text-black py-3 font-mono-label text-[10px] hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="floating-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border border-black bg-sky-400 text-black py-3 font-mono-label text-[10px] hover:bg-black hover:text-white disabled:opacity-50"
            >
              {submitting ? "REGISTRANDO..." : "AGENDAR FLOTANTE"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
