import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createAppointment, fetchServices, fetchAppointments } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { X, Instagram, Music2, Cake, MessageCircle, Search } from "lucide-react";
import ClientAutocomplete from "./ClientAutocomplete";
import { openBookingWhatsapp } from "../lib/whatsapp";

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
  const [serviceQuery, setServiceQuery] = useState("");
  const [appointments, setAppointments] = useState([]);

  const [specialistId, setSpecialistId] = useState(initialSpecialistId || "");
  const [serviceId, setServiceId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientInstagram, setClientInstagram] = useState("");
  const [clientTiktok, setClientTiktok] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(initialStartTime || "");
  const [isOverbooked, setIsOverbooked] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSpecialistId(initialSpecialistId || "");
      setStartTime(initialStartTime || "");
      setDate(initialDate || new Date().toISOString().slice(0, 10));
      setServiceId("");
      setClientName("");
      setClientPhone("");
      setClientInstagram("");
      setClientTiktok("");
      setClientBirthday("");
      setIsOverbooked(false);
      setNotifyWhatsapp(true);
      setServiceQuery("");
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
      const created = await createAppointment({
        specialist_id: specialistId,
        service_id: serviceId,
        client_name: clientName,
        client_phone: clientPhone,
        client_instagram: clientInstagram,
        client_tiktok: clientTiktok,
        client_birthday: clientBirthday,
        date,
        start_time: startTime,
        is_overbooked: isOverbooked,
      });
      toast.success(isOverbooked ? "Cita extra registrada" : "Cita registrada");

      if (notifyWhatsapp && clientPhone && clientPhone.replace(/\D/g, "").length >= 8) {
        const opened = openBookingWhatsapp({
          clientName,
          clientPhone,
          date,
          startTime,
          endTime: created?.end_time,
          serviceName: sv?.name,
          specialistName: sp?.name,
          branchName: branch?.name,
        });
        if (opened) {
          toast.info("Abriendo WhatsApp para confirmar a la cliente…");
        } else {
          toast.error("WhatsApp bloqueado por el navegador. Permita ventanas emergentes.");
        }
      }

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
        className="max-w-2xl bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Nueva Cita</DialogTitle>
        <DialogDescription className="sr-only">
          Formulario para registrar una nueva cita: seleccione especialista, servicio, cliente, fecha y hora.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b-2 border-black">
          <div>
            <div className="font-mono-label text-[10px] font-bold text-black">REGISTRO</div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold">
              Nueva <em className="italic">Cita</em>
            </div>
          </div>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            className="btn-invert border-2 border-black p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Specialist */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              ESPECIALISTA
            </label>
            <select
              data-testid="modal-specialist-select"
              value={specialistId}
              onChange={(e) => { setSpecialistId(e.target.value); setStartTime(""); setServiceId(""); }}
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
            >
              <option value="">— Seleccionar —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.specialty}</option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              SERVICIO
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black" strokeWidth={2} />
              <input
                type="text"
                data-testid="modal-service-search"
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Buscar servicio…"
                autoComplete="off"
                className="w-full border-2 border-black pl-9 pr-9 py-2 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
              />
              {serviceQuery && (
                <button
                  type="button"
                  data-testid="modal-service-search-clear"
                  onClick={() => setServiceQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black hover:opacity-70"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
            {(() => {
              const norm = (s) => (s || "")
                .toString()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
              const q = norm(serviceQuery.trim());
              const filtered = q
                ? services.filter((s) => norm(s.name).includes(q))
                : services;
              if (filtered.length === 0) {
                return (
                  <div
                    data-testid="modal-service-empty"
                    className="border-2 border-dashed border-neutral-300 p-4 text-center font-mono-label text-[10px] font-bold text-black"
                  >
                    Sin coincidencias para “{serviceQuery}”
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto" data-testid="modal-service-list">
                  {filtered.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`modal-service-${s.id}`}
                      onClick={() => { setServiceId(s.id); }}
                      className={`btn-invert border-2 p-3 text-left ${
                        serviceId === s.id ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black text-black"
                      }`}
                    >
                      <div className="font-serif-display text-base font-bold leading-tight">{s.name}</div>
                      <div className="font-mono-label text-[9px] font-bold opacity-80 mt-1">
                        {s.duration_minutes} MIN
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
            {serviceQuery && (
              <div className="font-mono-label text-[9px] font-bold text-black mt-1">
                {(() => {
                  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  const q = norm(serviceQuery.trim());
                  const count = q ? services.filter((s) => norm(s.name).includes(q)).length : services.length;
                  return `${count} resultado${count === 1 ? "" : "s"}`;
                })()}
              </div>
            )}
          </div>

          {/* Client */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">CLIENTE</label>
            <ClientAutocomplete
              testid="modal-client-name-input"
              value={clientName}
              onChange={setClientName}
              onPick={(c) => {
                setClientName(c.name || "");
                setClientPhone(c.phone || "");
                setClientInstagram(c.instagram || "");
                setClientTiktok(c.tiktok || "");
                setClientBirthday(c.birthday || "");
                toast.success(`Cliente cargada: ${c.name}`);
              }}
              placeholder="Nombre completo (escriba para buscar)"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              TELÉFONO <span className="opacity-70">(opcional)</span>
            </label>
            <input
              data-testid="modal-client-phone-input"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ej. 55 1234 5678"
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
            />
          </div>

          {/* Social + birthday */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5 text-black" strokeWidth={2} /> INSTAGRAM
              </label>
              <div className="flex">
                <span className="border-2 border-r-0 border-black px-3 py-3 bg-neutral-100 font-mono-label text-[10px] font-bold text-black flex items-center">@</span>
                <input
                  data-testid="modal-client-instagram-input"
                  type="text"
                  value={clientInstagram}
                  onChange={(e) => setClientInstagram(e.target.value.replace(/^@/, ""))}
                  placeholder="usuario"
                  autoComplete="off"
                  className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
                />
              </div>
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Music2 className="w-3.5 h-3.5 text-black" strokeWidth={2} /> TIKTOK
              </label>
              <div className="flex">
                <span className="border-2 border-r-0 border-black px-3 py-3 bg-neutral-100 font-mono-label text-[10px] font-bold text-black flex items-center">@</span>
                <input
                  data-testid="modal-client-tiktok-input"
                  type="text"
                  value={clientTiktok}
                  onChange={(e) => setClientTiktok(e.target.value.replace(/^@/, ""))}
                  placeholder="usuario"
                  autoComplete="off"
                  className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
                />
              </div>
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Cake className="w-3.5 h-3.5 text-black" strokeWidth={2} /> CUMPLEAÑOS
              </label>
              <input
                data-testid="modal-client-birthday-input"
                type="date"
                value={clientBirthday}
                onChange={(e) => setClientBirthday(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Date + Hour */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2">FECHA</label>
              <input
                data-testid="modal-date-input"
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
                HORA INICIO
              </label>
              <input
                data-testid="modal-start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Slots suggestion */}
          {sp && sv && (
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
                HORARIOS DISPONIBLES (sugeridos)
              </label>
              {slots.length === 0 ? (
                <div className="text-xs font-bold text-black border-2 border-dashed border-neutral-300 p-4">
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
                      className={`btn-invert border-2 py-2 px-2 font-mono-label text-[10px] font-bold ${
                        s.conflict
                          ? "border-neutral-200 text-neutral-300 line-through cursor-not-allowed"
                          : startTime === s.time
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 text-black hover:border-black"
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
            className={`flex items-center justify-between gap-4 border-2 p-3 cursor-pointer btn-invert ${
              isOverbooked ? "border-black bg-black text-white" : "border-neutral-300 text-black hover:border-black"
            }`}
          >
            <div>
              <div className="font-mono-label text-[10px] font-bold">CITA EXTRA (SOBRECUPO)</div>
              <div className="text-[11px] font-medium opacity-80 mt-1">
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

          {/* WhatsApp notification toggle */}
          <label
            data-testid="notify-whatsapp-toggle"
            className={`flex items-center justify-between gap-4 border-2 p-3 cursor-pointer btn-invert ${
              notifyWhatsapp ? "border-black bg-emerald-50 text-black" : "border-neutral-300 text-black hover:border-black"
            }`}
          >
            <div className="flex items-start gap-3">
              <MessageCircle className="w-4 h-4 mt-0.5 shrink-0 text-black" strokeWidth={2} />
              <div>
                <div className="font-mono-label text-[10px] font-bold">CONFIRMAR POR WHATSAPP</div>
                <div className="text-[11px] font-medium opacity-80 mt-1">
                  {clientPhone
                    ? "Al guardar se abrirá WhatsApp con el mensaje de confirmación pre-armado."
                    : "Agregue un teléfono para habilitar esta opción."}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              data-testid="notify-whatsapp-checkbox"
              checked={notifyWhatsapp && !!clientPhone}
              disabled={!clientPhone}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              className="w-5 h-5 accent-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            />
          </label>

          {/* Summary */}
          {sv && startTime && (
            <div className="border-2 border-black p-4 bg-neutral-50 text-black" data-testid="modal-summary">
              <div className="font-mono-label text-[9px] font-bold text-black mb-2">RESUMEN</div>
              <div className="text-sm font-bold">
                {startTime} — {minToTime(timeToMin(startTime) + sv.duration_minutes)}
              </div>
              <div className="text-xs font-semibold text-neutral-800 mt-1">{sv.name} · {sp?.name}</div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="modal-cancel-btn"
              className="btn-invert flex-1 border-2 border-black bg-white text-black py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="modal-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border-2 border-black bg-black text-white py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting ? "REGISTRANDO..." : "CONFIRMAR CITA"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
