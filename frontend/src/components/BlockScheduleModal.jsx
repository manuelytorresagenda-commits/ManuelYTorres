import { useState } from "react";
import { X, Clock, GraduationCap, Coffee } from "lucide-react";
import { toast } from "sonner";
import { createBlockSchedule } from "../lib/api";

const FIXED_BREAKS = [
  { label: "9:00 AM a 2:00 PM", start: "09:00", end: "14:00" },
  { label: "10:00 AM a 3:00 PM", start: "10:00", end: "15:00" },
  { label: "2:00 PM a 8:00 PM", start: "14:00", end: "20:00" },
  { label: "2:30 PM a 8:00 PM", start: "14:30", end: "20:00" },
  { label: "3:00 PM a 8:00 PM", start: "15:00", end: "20:00" },
];

export default function BlockScheduleModal({
  open,
  onClose,
  onCreated,
  specialists = [],
  initialSpecialistId = "",
  date,
}) {
  const [blockType, setBlockType] = useState("descanso");
  const [specialistId, setSpecialistId] = useState(initialSpecialistId);
  const [selectedBreak, setSelectedBreak] = useState(FIXED_BREAKS[0]);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("12:00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!specialistId) {
      toast.error("Seleccione una especialista");
      return;
    }

    const startTime = blockType === "descanso" ? selectedBreak.start : customStart;
    const endTime = blockType === "descanso" ? selectedBreak.end : customEnd;
    const finalReason =
      reason.trim() || (blockType === "descanso" ? "Descanso" : "Capacitación");

    setLoading(true);
    try {
      await createBlockSchedule({
        specialist_id: specialistId,
        date,
        start_time: startTime,
        end_time: endTime,
        type: blockType,
        reason: finalReason,
      });

      toast.success(
        `${blockType === "descanso" ? "Descanso" : "Capacitación"} asignado correctamente`
      );
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar el bloqueo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-black w-full max-w-md p-6 relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-black hover:opacity-70 transition-opacity"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-serif-display text-2xl font-bold text-black mb-1">
          Bloquear Horario
        </h3>
        <p className="text-xs font-medium text-neutral-600 mb-6">
          Asignar descanso predefinido o capacitación a libre demanda.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Tipo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 border border-black">
            <button
              type="button"
              onClick={() => setBlockType("descanso")}
              className={`py-2 text-xs font-mono-label font-bold flex items-center justify-center gap-1.5 transition-colors ${
                blockType === "descanso"
                  ? "bg-black text-white"
                  : "text-black hover:bg-neutral-200"
              }`}
            >
              <Coffee className="w-3.5 h-3.5" /> Descanso
            </button>
            <button
              type="button"
              onClick={() => setBlockType("capacitacion")}
              className={`py-2 text-xs font-mono-label font-bold flex items-center justify-center gap-1.5 transition-colors ${
                blockType === "capacitacion"
                  ? "bg-black text-white"
                  : "text-black hover:bg-neutral-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Capacitación
            </button>
          </div>

          {/* Especialista */}
          <div>
            <label className="block font-mono-label text-[10px] font-bold text-black uppercase mb-1">
              Especialista
            </label>
            <select
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="w-full border border-black p-2 font-mono-label text-xs bg-white text-black focus:outline-none"
              required
            >
              <option value="">Seleccione especialista...</option>
              {specialists.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} {sp.specialty ? `(${sp.specialty})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Opciones de Descanso Fijo */}
          {blockType === "descanso" ? (
            <div>
              <label className="block font-mono-label text-[10px] font-bold text-black uppercase mb-1">
                Horario de Descanso
              </label>
              <div className="space-y-1.5">
                {FIXED_BREAKS.map((br) => (
                  <button
                    key={br.label}
                    type="button"
                    onClick={() => setSelectedBreak(br)}
                    className={`w-full text-left px-3 py-2 border font-mono-label text-xs font-bold transition-colors ${
                      selectedBreak.label === br.label
                        ? "border-black bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-black hover:border-black"
                    }`}
                  >
                    ☕ {br.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Horario Libre para Capacitación */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-label text-[10px] font-bold text-black uppercase mb-1">
                  Hora Inicio
                </label>
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border border-black p-2 font-mono-label text-xs bg-white text-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-mono-label text-[10px] font-bold text-black uppercase mb-1">
                  Hora Fin
                </label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-black p-2 font-mono-label text-xs bg-white text-black focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Motivo Opcional */}
          <div>
            <label className="block font-mono-label text-[10px] font-bold text-black uppercase mb-1">
              Nota / Detalle (Opcional)
            </label>
            <input
              type="text"
              placeholder={
                blockType === "descanso"
                  ? "Ej. Permiso personal"
                  : "Ej. Curso L'Oréal"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-black p-2 font-mono-label text-xs bg-white text-black focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-black text-xs font-mono-label font-bold hover:bg-neutral-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 border border-black bg-black text-white text-xs font-mono-label font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar Bloqueo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
