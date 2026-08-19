import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createCoverage, fetchBranches, fetchSpecialists } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { X, UserCheck, Calendar, UserPlus, Sparkles, Clock } from "lucide-react";

export default function CoverageModal({ open, onClose, onCreated }) {
  const { branch } = useAuth();
  const [isGuest, setIsGuest] = useState(false); // false = Estilista de otra sucursal, true = Invitado externo
  const [branches, setBranches] = useState([]);
  const [allSpecialists, setAllSpecialists] = useState([]);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState("");

  // Campos para invitado externo
  const [guestName, setGuestName] = useState("");
  const [specialty, setSpecialty] = useState("Estilista Invitada");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  // Fechas y motivo
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Apoyo temporal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
      setSelectedSpecialistId("");
      setGuestName("");
      setSpecialty("Estilista Invitada");
      setStartTime("09:00");
      setEndTime("18:00");
      setReason("Apoyo temporal");
      setIsGuest(false);

      // Cargar todas las sucursales y especialistas de otras sucursales
      Promise.all([fetchBranches(), fetchSpecialists()])
        .then(([brs, sps]) => {
          setBranches(brs);
          // Filtrar especialistas que NO pertenezcan a la sucursal actual para apoyo interno
          const others = sps.filter((s) => s.branch_id !== branch?.id);
          setAllSpecialists(others.length > 0 ? others : sps);
        })
        .catch(() => {});
    }
  }, [open, branch]);

  const submit = async (e) => {
    e.preventDefault();
    if (!branch?.id) {
      toast.error("Sucursal no activa");
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

    if (!isGuest && !selectedSpecialistId) {
      toast.error("Seleccione al estilista de apoyo");
      return;
    }

    if (isGuest && !guestName.trim()) {
      toast.error("Ingrese el nombre del estilista invitado");
      return;
    }

    setSubmitting(true);
    try {
      await createCoverage({
        target_branch_id: branch.id,
        is_guest: isGuest,
        specialist_id: isGuest ? null : selectedSpecialistId,
        guest_name: isGuest ? guestName.trim() : "",
        specialty: isGuest ? specialty.trim() : "",
        start_time: isGuest ? startTime : "09:00",
        end_time: isGuest ? endTime : "18:00",
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || "Apoyo",
      });

      toast.success(
        isGuest
          ? "Estilista invitado asignado correctamente"
          : "Cobertura de apoyo asignada correctamente"
      );
      onCreated && onCreated();
      onClose && onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo registrar la asignación");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="coverage-modal"
        className="max-w-xl bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Asignar Apoyo o Invitado</DialogTitle>
        <DialogDescription className="sr-only">
          Permite habilitar la presencia temporal de un estilista de otra sucursal o un invitado especial por rango de fechas.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b-2 border-black">
          <div>
            <div className="font-mono-label text-[10px] font-bold text-black">DISPONIBILIDAD TEMPORAL</div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold">
              Asignar <em className="italic">Apoyo / Invitado</em>
            </div>
          </div>
          <button
            type="button"
            data-testid="coverage-modal-close-btn"
            onClick={onClose}
            className="btn-invert border-2 border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-2 border-b-2 border-black">
          <button
            type="button"
            onClick={() => setIsGuest(false)}
            className={`py-3 font-mono-label text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5 ${
              !isGuest ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" strokeWidth={2} />
            ESTILISTA DE OTRA SUCURSAL
          </button>
          <button
            type="button"
            onClick={() => setIsGuest(true)}
            className={`py-3 font-mono-label text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5 border-l-2 border-black ${
              isGuest ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            INVITADO EXTERNO / FREELANCE
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          {!isGuest ? (
            /* Modo 1: Estilista Interno */
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-black" strokeWidth={2} /> SELECCIONAR ESTILISTA *
              </label>
              <select
                data-testid="coverage-specialist-select"
                value={selectedSpecialistId}
                onChange={(e) => setSelectedSpecialistId(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              >
                <option value="">— Seleccionar Estilista —</option>
                {allSpecialists.map((s) => {
                  const spBranch = branches.find((b) => b.id === s.branch_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.specialty} ({spBranch?.name || "Sin sucursal"})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            /* Modo 2: Invitado Externo */
            <div className="space-y-4">
              <div>
                <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-black" strokeWidth={2} /> NOMBRE DEL INVITADO(A) *
                </label>
                <input
                  type="text"
                  data-testid="coverage-guest-name-input"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej. Jeny Monroy"
                  className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
                    ESPECIALIDAD
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Colorimetría, Master..."
                    className="w-full border-2 border-black px-3 py-2.5 bg-white outline-none font-mono-label text-xs font-bold text-black"
                  />
                </div>
                <div>
                  <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-black" /> HORA ENTRADA
                  </label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full border-2 border-black px-3 py-2.5 bg-white outline-none font-mono-label text-xs font-bold text-black"
                  />
                </div>
                <div>
                  <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-black" /> HORA SALIDA
                  </label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="18:00"
                    className="w-full border-2 border-black px-3 py-2.5 bg-white outline-none font-mono-label text-xs font-bold text-black"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} /> DESDE (FECHA INICIO) *
              </label>
              <input
                data-testid="coverage-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} /> HASTA (FECHA FIN) *
              </label>
              <input
                data-testid="coverage-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              MOTIVO / ETIQUETA
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Apoyo por 15 días, Cubriendo incapacidad, Invitada especial"
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-invert flex-1 border-2 border-black bg-white text-black py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-invert flex-1 border-2 border-black bg-black text-white py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting ? "GUARDANDO..." : isGuest ? "ASIGNAR INVITADO" : "ASIGNAR APOYO"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
