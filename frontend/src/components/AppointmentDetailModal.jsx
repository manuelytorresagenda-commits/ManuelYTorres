import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { updateAppointmentExtras, updateAppointment } from "../lib/api";
import { toast } from "sonner";
import { X, Plus, Trash2, Instagram, Music2, Cake, CalendarClock, Pencil, Save, UserCheck } from "lucide-react";
import RescheduleModal from "./RescheduleModal";

export default function AppointmentDetailModal({
  open,
  onClose,
  onUpdated,
  appointment,
  specialist,
  service,
}) {
  const [extras, setExtras] = useState([]);
  const [newExtra, setNewExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  // Estado para modo edición de datos
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    client_name: "",
    client_phone: "",
    client_instagram: "",
    client_tiktok: "",
    client_birthday: "",
    receptionist_name: "",
  });

  useEffect(() => {
    if (open && appointment) {
      setExtras(appointment.additional_services || []);
      setNewExtra("");
      setIsEditing(false);
      setEditForm({
        client_name: appointment.client_name || "",
        client_phone: appointment.client_phone || "",
        client_instagram: appointment.client_instagram || "",
        client_tiktok: appointment.client_tiktok || "",
        client_birthday: appointment.client_birthday || "",
        receptionist_name: appointment.receptionist_name || "",
      });
    }
  }, [open, appointment]);

  if (!appointment) return null;

  const persistExtras = async (next) => {
    setSaving(true);
    try {
      await updateAppointmentExtras(appointment.id, next);
      setExtras(next);
      onUpdated && onUpdated();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  };

  const addExtra = async () => {
    const name = newExtra.trim();
    if (!name) return;
    const next = [...extras, { name }];
    setNewExtra("");
    await persistExtras(next);
    toast.success("Extra añadido");
  };

  const removeExtra = async (idx) => {
    const next = extras.filter((_, i) => i !== idx);
    await persistExtras(next);
    toast.success("Extra eliminado");
  };

  const handleSaveFields = async () => {
    if (!editForm.client_name.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await updateAppointment(appointment.id, editForm);
      toast.success("Cita actualizada con éxito");
      setIsEditing(false);
      onUpdated && onUpdated();
    } catch {
      toast.error("Error al actualizar la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="appointment-detail-modal"
        className="max-w-md bg-white border border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Detalle de Cita</DialogTitle>
        <DialogDescription className="sr-only">
          Ver detalles de la cita, editar datos del cliente y administrar servicios adicionales.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 border-b border-black">
          <div>
            <div className="font-mono-label text-[10px] text-neutral-500">DETALLE DE CITA</div>
            {isEditing ? (
              <input
                type="text"
                value={editForm.client_name}
                onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                className="font-serif-display text-2xl mt-1 leading-none border border-black px-2 py-1 w-full bg-neutral-50"
                placeholder="Nombre del cliente"
              />
            ) : (
              <div className="font-serif-display text-2xl mt-1 leading-none">
                {appointment.client_name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-invert border border-black px-3 py-2 hover:bg-black hover:text-white flex items-center gap-1.5 font-mono-label text-[10px]"
                title="Editar datos de la cita"
              >
                <Pencil className="w-3 h-3" strokeWidth={1.5} />
                EDITAR
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveFields}
                disabled={saving}
                className="btn-invert border border-black bg-black text-white px-3 py-2 hover:bg-white hover:text-black flex items-center gap-1.5 font-mono-label text-[10px]"
              >
                <Save className="w-3 h-3" strokeWidth={1.5} />
                GUARDAR
              </button>
            )}

            {appointment.status !== "Finalizada" && !isEditing && (
              <button
                type="button"
                data-testid="detail-reschedule-btn"
                onClick={() => setRescheduleOpen(true)}
                className="btn-invert border border-black px-3 py-2 hover:bg-black hover:text-white flex items-center gap-1.5 font-mono-label text-[10px]"
                title="Reagendar cita"
              >
                <CalendarClock className="w-3 h-3" strokeWidth={1.5} />
                REAGENDAR
              </button>
            )}
            <button
              type="button"
              data-testid="detail-close-btn"
              onClick={onClose}
              className="btn-invert border border-black p-2 hover:bg-black hover:text-white"
              aria-label="Cerrar"
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Cita info */}
          <div className="border border-neutral-200 p-4 space-y-2.5" data-testid="detail-info">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono-label text-[9px] text-neutral-500">HORARIO</span>
              <span className="font-mono-label text-[10px]">
                {appointment.start_time} — {appointment.end_time}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono-label text-[9px] text-neutral-500">ESPECIALISTA</span>
              <span className="text-xs font-semibold">{specialist?.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono-label text-[9px] text-neutral-500">SERVICIO</span>
              <span className="text-xs">
                {appointment.is_floating
                  ? appointment.custom_service_name
                  : (service?.name || "—")}
              </span>
            </div>

            {/* Recepcionista */}
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono-label text-[9px] text-neutral-500 flex items-center gap-1">
                <UserCheck className="w-3 h-3" strokeWidth={1.5} /> RECEPCIONISTA
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.receptionist_name}
                  onChange={(e) => setEditForm({ ...editForm, receptionist_name: e.target.value })}
                  placeholder="Atendido por..."
                  className="border border-black px-2 py-0.5 text-xs text-right bg-neutral-50"
                />
              ) : (
                <span className="text-xs">{appointment.receptionist_name || "—"}</span>
              )}
            </div>

            {/* Teléfono */}
            <div className="flex justify-between items-center text-xs" data-testid="detail-phone">
              <span className="font-mono-label text-[9px] text-neutral-500">TELÉFONO</span>
              {isEditing ? (
                <input
                  type="tel"
                  value={editForm.client_phone}
                  onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })}
                  placeholder="Número de teléfono"
                  className="border border-black px-2 py-0.5 text-xs font-mono-label text-right bg-neutral-50"
                />
              ) : appointment.client_phone ? (
                <a
                  href={`tel:${appointment.client_phone}`}
                  className="font-mono-label text-[10px] underline"
                >
                  {appointment.client_phone}
                </a>
              ) : (
                <span className="text-xs text-neutral-400">—</span>
              )}
            </div>

            {/* Instagram */}
            <div className="flex justify-between items-center text-xs" data-testid="detail-instagram">
              <span className="font-mono-label text-[9px] text-neutral-500 flex items-center gap-1">
                <Instagram className="w-3 h-3" strokeWidth={1.5} /> INSTAGRAM
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.client_instagram}
                  onChange={(e) => setEditForm({ ...editForm, client_instagram: e.target.value })}
                  placeholder="usuario (sin @)"
                  className="border border-black px-2 py-0.5 text-xs font-mono-label text-right bg-neutral-50"
                />
              ) : appointment.client_instagram ? (
                <a
                  href={`https://instagram.com/${appointment.client_instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono-label text-[10px] underline"
                >
                  @{appointment.client_instagram}
                </a>
              ) : (
                <span className="text-xs text-neutral-400">—</span>
              )}
            </div>

            {/* TikTok */}
            <div className="flex justify-between items-center text-xs" data-testid="detail-tiktok">
              <span className="font-mono-label text-[9px] text-neutral-500 flex items-center gap-1">
                <Music2 className="w-3 h-3" strokeWidth={1.5} /> TIKTOK
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.client_tiktok}
                  onChange={(e) => setEditForm({ ...editForm, client_tiktok: e.target.value })}
                  placeholder="usuario (sin @)"
                  className="border border-black px-2 py-0.5 text-xs font-mono-label text-right bg-neutral-50"
                />
              ) : appointment.client_tiktok ? (
                <a
                  href={`https://tiktok.com/@${appointment.client_tiktok}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono-label text-[10px] underline"
                >
                  @{appointment.client_tiktok}
                </a>
              ) : (
                <span className="text-xs text-neutral-400">—</span>
              )}
            </div>

            {/* Cumpleaños */}
            <div className="flex justify-between items-center text-xs" data-testid="detail-birthday">
              <span className="font-mono-label text-[9px] text-neutral-500 flex items-center gap-1">
                <Cake className="w-3 h-3" strokeWidth={1.5} /> CUMPLEAÑOS
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.client_birthday}
                  onChange={(e) => setEditForm({ ...editForm, client_birthday: e.target.value })}
                  placeholder="YYYY-MM-DD o MM-DD"
                  className="border border-black px-2 py-0.5 text-xs font-mono-label text-right bg-neutral-50"
                />
              ) : appointment.client_birthday ? (
                <span className="font-mono-label text-[10px]">{appointment.client_birthday}</span>
              ) : (
                <span className="text-xs text-neutral-400">—</span>
              )}
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-mono-label text-[9px] text-neutral-500">ESTADO</span>
              <span className="font-mono-label text-[10px] font-bold">{appointment.status}</span>
            </div>

            {(appointment.is_overbooked || appointment.is_floating) && (
              <div className="flex justify-between items-center text-xs" data-testid="detail-tags">
                <span className="font-mono-label text-[9px] text-neutral-500">TIPO</span>
                <span className="flex gap-1">
                  {appointment.is_floating && (
                    <span className="font-mono-label text-[8px] bg-sky-400 text-black px-1.5 py-0.5 border border-black">
                      FLOTANTE
                    </span>
                  )}
                  {appointment.is_overbooked && !appointment.is_floating && (
                    <span className="font-mono-label text-[8px] bg-amber-400 text-black px-1.5 py-0.5 border border-black">
                      EXTRA
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Extras */}
          <div data-testid="extras-section">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono-label text-[10px] text-neutral-500">
                SERVICIOS ADICIONALES
              </div>
              <span className="font-mono-label text-[9px] text-neutral-400">
                {extras.length} ITEM{extras.length === 1 ? "" : "S"}
              </span>
            </div>

            {extras.length === 0 ? (
              <div
                data-testid="extras-empty"
                className="text-xs text-neutral-500 border border-dashed border-neutral-300 p-3 mb-3"
              >
                Sin extras. Añada uno abajo.
              </div>
            ) : (
              <ul className="space-y-1 mb-3" data-testid="extras-list">
                {extras.map((e, idx) => (
                  <li
                    key={e.id || `${e.name}-${idx}`}
                    data-testid={`extra-item-${idx}`}
                    className="flex items-center justify-between border border-neutral-200 px-3 py-2"
                  >
                    <span className="text-sm flex items-center gap-2">
                      <span className="w-1 h-1 bg-black rounded-full inline-block" />
                      {e.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExtra(idx)}
                      data-testid={`remove-extra-${idx}`}
                      disabled={saving}
                      className="btn-invert border border-neutral-300 p-1.5 hover:bg-black hover:text-white disabled:opacity-50"
                      aria-label="Eliminar extra"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new */}
            <div className="flex gap-2">
              <input
                data-testid="new-extra-input"
                type="text"
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExtra();
                  }
                }}
                placeholder="Ej. Ampolleta, Peinado..."
                className="flex-1 border border-black px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 text-sm"
              />
              <button
                type="button"
                data-testid="add-extra-btn"
                onClick={addExtra}
                disabled={saving || !newExtra.trim()}
                className="btn-invert border border-black bg-black text-white px-4 font-mono-label text-[10px] hover:bg-white hover:text-black disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" strokeWidth={2} />
                AÑADIR
              </button>
            </div>
          </div>
        </div>
      </DialogContent>

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        appointment={appointment}
        onDone={() => {
          setRescheduleOpen(false);
          onUpdated && onUpdated();
          onClose && onClose();
        }}
      />
    </Dialog>
  );
}
