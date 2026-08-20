import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { createAppointment, fetchServices, fetchReceptionists } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { X, Wind, Instagram, Music2, Cake, Search, UserCheck } from "lucide-react";
import ClientAutocomplete from "./ClientAutocomplete";

const QUICK_DURATIONS = [15, 30, 45, 60, 90];

export default function FloatingAppointmentModal({
  open,
  onClose,
  onCreated,
  specialists = [],
}) {
  const { branch } = useAuth();
  const [services, setServices] = useState([]);
  const [receptionists, setReceptionists] = useState([]);
  const [serviceQuery, setServiceQuery] = useState("");

  const [specialistId, setSpecialistId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientInstagram, setClientInstagram] = useState("");
  const [clientTiktok, setClientTiktok] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");
  const [receptionistName, setReceptionistName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSpecialistId("");
      setServiceId("");
      setCustomServiceName("");
      setClientName("");
      setClientPhone("");
      setClientInstagram("");
      setClientTiktok("");
      setClientBirthday("");
      setReceptionistName("");
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("");
      setDuration(30);
      setServiceQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !branch) return;
    fetchServices({ branch_id: branch.id })
      .then(setServices)
      .catch(() => toast.error("Error cargando servicios"));
    fetchReceptionists({ branch_id: branch.id })
      .then((rc) => {
        setReceptionists(rc);
        if (rc && rc.length > 0) {
          setReceptionistName(rc[0].name);
        }
      })
      .catch(() => {});
  }, [open, branch]);

  const sv = services.find((s) => s.id === serviceId);
  const resolvedServiceName = sv ? sv.name : customServiceName.trim();

  const handleSelectService = (s) => {
    if (serviceId === s.id) {
      setServiceId("");
      setCustomServiceName("");
    } else {
      setServiceId(s.id);
      setCustomServiceName(s.name);
      if (s.duration_minutes) {
        setDuration(Number(s.duration_minutes));
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!specialistId || !clientName || !resolvedServiceName || !date || !startTime || !duration) {
      toast.error("Complete todos los campos requeridos");
      return;
    }
    const finalDuration = parseInt(duration, 10);
    if (!finalDuration || finalDuration <= 0) {
      toast.error("La duración debe ser mayor a 0 minutos");
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        specialist_id: specialistId,
        service_id: serviceId || "",
        client_name: clientName,
        client_phone: clientPhone,
        client_instagram: clientInstagram,
        client_tiktok: clientTiktok,
        client_birthday: clientBirthday,
        receptionist_name: receptionistName,
        date,
        start_time: startTime,
        is_floating: true,
        custom_service_name: resolvedServiceName,
        custom_duration_minutes: finalDuration,
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
        className="max-w-2xl bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Cita Flotante</DialogTitle>
        <DialogDescription className="sr-only">
          Cita rápida que puede solaparse con horarios ya ocupados.
        </DialogDescription>

        <div className="flex items-start justify-between p-6 lg:p-8 border-b-2 border-black bg-sky-50">
          <div>
            <div className="flex items-center gap-2">
              <Wind className="w-3.5 h-3.5 text-black" strokeWidth={2} />
              <span className="font-mono-label text-[10px] font-bold text-black">CITA RÁPIDA</span>
            </div>
            <div className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold">
              Cita <em className="italic">Flotante</em>
            </div>
            <div className="text-[11px] font-semibold text-neutral-800 mt-1">
              Permite solapar con citas existentes y rellenar huecos.
            </div>
          </div>
          <button
            type="button"
            data-testid="floating-close-btn"
            onClick={onClose}
            className="btn-invert border-2 border-black bg-white p-2 hover:bg-black hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 lg:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Especialista */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              ESPECIALISTA
            </label>
            <select
              data-testid="floating-specialist-select"
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
            >
              <option value="">— Seleccionar —</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Servicio */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              SERVICIO
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black" strokeWidth={2} />
              <input
                type="text"
                data-testid="floating-service-search"
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Buscar servicio…"
                autoComplete="off"
                className="w-full border-2 border-black pl-9 pr-9 py-2 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
              />
              {serviceQuery && (
                <button
                  type="button"
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
                  <div className="border-2 border-dashed border-neutral-300 p-4 text-center font-mono-label text-[10px] font-bold text-black">
                    Sin coincidencias para “{serviceQuery}”
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto" data-testid="floating-service-list">
                  {filtered.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectService(s)}
                      className={`btn-invert border-2 p-3 text-left ${
                        serviceId === s.id
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 hover:border-black text-black"
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

            {/* Opción de servicio manual alternativo */}
            <div className="mt-2">
              <input
                type="text"
                data-testid="floating-service-custom-input"
                value={customServiceName}
                onChange={(e) => {
                  setCustomServiceName(e.target.value);
                  if (serviceId) setServiceId("");
                }}
                placeholder="O escriba un servicio manual (ej. Retoque rápido, Cejas, Consulta...)"
                className="w-full border-2 border-black px-4 py-2.5 bg-white outline-none focus:ring-1 focus:ring-black font-serif-display text-sm font-bold text-black placeholder:text-neutral-500 placeholder:font-sans placeholder:text-xs"
              />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">CLIENTE</label>
            <ClientAutocomplete
              testid="floating-client-name-input"
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

          {/* Teléfono */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              TELÉFONO <span className="opacity-70">(opcional)</span>
            </label>
            <input
              data-testid="floating-client-phone-input"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ej. 55 1234 5678"
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black placeholder:text-neutral-500"
            />
          </div>

          {/* Redes y Cumpleaños */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5 text-black" strokeWidth={2} /> INSTAGRAM
              </label>
              <div className="flex">
                <span className="border-2 border-r-0 border-black px-3 py-3 bg-neutral-100 font-mono-label text-[10px] font-bold text-black flex items-center">@</span>
                <input
                  data-testid="floating-client-instagram-input"
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
                  data-testid="floating-client-tiktok-input"
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
                data-testid="floating-client-birthday-input"
                type="date"
                value={clientBirthday}
                onChange={(e) => setClientBirthday(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2">FECHA</label>
              <input
                data-testid="floating-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
                HORA INICIO
              </label>
              <input
                data-testid="floating-start-time-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
              />
            </div>
          </div>

          {/* Duración */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2">
              DURACIÓN (MIN)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`floating-duration-${m}`}
                  onClick={() => setDuration(m)}
                  className={`btn-invert border-2 px-4 py-2 font-mono-label text-[10px] font-bold ${
                    duration === m
                      ? "border-black bg-black text-white"
                      : "border-neutral-300 text-black hover:border-black"
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
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
              className="w-full border-2 border-black px-4 py-2 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
            />
          </div>

          {/* Recepcionista */}
          <div>
            <label className="font-mono-label text-[10px] font-bold text-black block mb-2 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-black" strokeWidth={2} /> RECEPCIONISTA (QUIEN ATENDIÓ)
            </label>
            <select
              data-testid="floating-receptionist-select"
              value={receptionistName}
              onChange={(e) => setReceptionistName(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black font-mono-label text-xs font-bold text-black"
            >
              <option value="">— Seleccionar —</option>
              {receptionists.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="floating-cancel-btn"
              className="btn-invert flex-1 border-2 border-black bg-white text-black py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              data-testid="floating-submit-btn"
              disabled={submitting}
              className="btn-invert flex-1 border-2 border-black bg-sky-400 text-black py-3 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white disabled:opacity-50"
            >
              {submitting ? "REGISTRANDO..." : "AGENDAR FLOTANTE"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
