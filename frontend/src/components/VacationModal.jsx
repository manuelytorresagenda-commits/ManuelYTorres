import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createVacation } from "../lib/api";
import { toast } from "sonner";
import { X, Palmtree, Calendar, UserCheck } from "lucide-react";

export default function VacationModal({ open, onClose, onCreated, specialists = [] }) {
  const [specialistId, setSpecialistId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Vacaciones");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSpecialistId("");
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
      setReason("Vacaciones");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!specialistId) {
      toast.error("Seleccione un especialista");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Complete el rango de fechas");
      return;
    }
    if (startDate > endDate) {
      toast.error("La fecha de inicio no puede ser posterior a la fecha de fin");
      return;
    }

    setSubmitting(true);
    try {
      await createVacation({
        specialist_id: specialistId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || "Vacaciones",
      });
      toast.success("Periodo de vacaciones registrado correctamente");
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo registrar el periodo de vacaciones");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="vacation-modal"
        className="max-w-xl bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Asignar Vacaciones</DialogTitle>
        <DialogDescription className="sr-only">
          Bloquea el calendario del especialista seleccionado durante el rango de fechas establecido.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b-2 border-black">
          <div>
            <div className="font-mono-label text-[10px] font-bold text-black">DISPONIBILIDAD</div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold">
              Asignar <em className="italic">Vacaciones</em>
            </div>
          </div>
          <button
            type="button"
            data-testid="vacation-modal-close-btn"
            onClick={onClose}
            className="btn-invert border-2 border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Especialista */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-black" strokeWidth={2} /> ESPECIALISTA *
            </label>
            <select
              data-testid="vacation-specialist-select"
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
            >
              <option value="">— Seleccionar Especialista —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} /> DESDE (INICIO) *
              </label>
              <input
                data-testid="vacation-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} /> HASTA (FIN) *
              </label>
              <input
                data-testid="vacation-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
              <Palmtree className="w-3.5 h-3.5 text-black" strokeWidth={2} /> MOTIVO / ETIQUETA
            </label>
            <input
              data-testid="vacation-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Vacaciones, Permiso especial, Incapacidad"
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              data-testid="vacation-modal-cancel-btn"
              className="btn-invert flex-1 border-2 border-black bg-white text-black py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="vacation-modal-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border-2 border-black bg-black text-white py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting ? "GUARDANDO..." : "ASIGNAR VACACIONES"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
