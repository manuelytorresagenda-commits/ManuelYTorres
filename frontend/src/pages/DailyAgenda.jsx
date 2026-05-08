import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import SpecialistFilter from "../components/SpecialistFilter";
import NewAppointmentModal from "../components/NewAppointmentModal";
import FloatingAppointmentModal from "../components/FloatingAppointmentModal";
import AppointmentDetailModal from "../components/AppointmentDetailModal";
import {
  fetchAppointments,
  fetchSpecialists,
  fetchServices,
  updateAppointmentStatus,
  deleteAppointment,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, Play, CheckCircle2, Calendar, Wind } from "lucide-react";
import { toast } from "sonner";

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08..20

const STATUS_STYLES = {
  Confirmada: "bg-white border-black text-black",
  "En curso": "bg-black border-black text-white",
  Finalizada: "bg-neutral-200 border-neutral-400 text-neutral-500 line-through",
};

const OVERBOOKED_STYLES = {
  Confirmada: "bg-amber-50 border-black text-black border-dashed",
  "En curso": "bg-amber-100 border-black text-black border-dashed",
  Finalizada: "bg-amber-50 border-neutral-400 text-neutral-500 line-through border-dashed",
};

const FLOATING_STYLES = {
  Confirmada: "bg-sky-50 border-sky-700 text-black border-dashed",
  "En curso": "bg-sky-100 border-sky-700 text-black border-dashed",
  Finalizada: "bg-sky-50 border-neutral-400 text-neutral-500 line-through border-dashed",
};

function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function DailyAgenda() {
  const [appointments, setAppointments] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSpecialist, setFilterSpecialist] = useState("all");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [floatingModalOpen, setFloatingModalOpen] = useState(false);
  const [modalSpecialistId, setModalSpecialistId] = useState("");
  const [modalStartTime, setModalStartTime] = useState("");
  const [detailAppt, setDetailAppt] = useState(null);
  const { branch } = useAuth();

  const load = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const [a, sp, sv] = await Promise.all([
        fetchAppointments({ date, branch_id: branch.id }),
        fetchSpecialists({ branch_id: branch.id }),
        fetchServices({ branch_id: branch.id }),
      ]);
      setAppointments(a);
      setSpecialists(sp);
      setServices(sv);
    } catch (e) {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [branch, date]);

  const findService = (id) => services.find((s) => s.id === id);
  const findSpecialist = (id) => specialists.find((s) => s.id === id);

  const visibleSpecialists = useMemo(() => {
    if (filterSpecialist === "all") return specialists;
    return specialists.filter((s) => s.id === filterSpecialist);
  }, [specialists, filterSpecialist]);

  const filteredAppointments = useMemo(() => {
    if (filterSpecialist === "all") return appointments;
    return appointments.filter((a) => a.specialist_id === filterSpecialist);
  }, [appointments, filterSpecialist]);

  // Build a per-specialist map: { [specialistId]: { startsAt: Map(hour->Array<{appt, span}>), coveredHours: Set(hours) } }
  // Multiple appointments can share the same starting hour (overbooking/extras).
  const grid = useMemo(() => {
    const result = {};
    visibleSpecialists.forEach((sp) => {
      result[sp.id] = { startsAt: new Map(), coveredHours: new Set() };
    });
    filteredAppointments.forEach((a) => {
      if (!result[a.specialist_id]) return;
      const startMin = timeToMin(a.start_time);
      const endMin = timeToMin(a.end_time);
      const startHour = Math.floor(startMin / 60);
      const endHour = Math.ceil(endMin / 60);
      const spanRows = Math.max(1, endHour - startHour);
      const list = result[a.specialist_id].startsAt.get(startHour) || [];
      list.push({ appt: a, span: spanRows });
      result[a.specialist_id].startsAt.set(startHour, list);
    });
    // Compute coveredHours from the max span at each starting hour
    Object.values(result).forEach((bucket) => {
      bucket.startsAt.forEach((list, startHour) => {
        const maxSpan = list.reduce((m, x) => Math.max(m, x.span), 1);
        for (let h = startHour + 1; h < startHour + maxSpan; h++) {
          bucket.coveredHours.add(h);
        }
      });
    });
    return result;
  }, [filteredAppointments, visibleSpecialists]);

  const changeStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      toast.success(`Cita ${status.toLowerCase()}`);
      load();
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta cita?")) return;
    try {
      await deleteAppointment(id);
      toast.success("Cita eliminada");
      load();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const openModal = (specialistId, hour) => {
    setModalSpecialistId(specialistId);
    setModalStartTime(`${String(hour).padStart(2, "0")}:00`);
    setModalOpen(true);
  };

  const openModalEmpty = () => {
    setModalSpecialistId("");
    setModalStartTime("");
    setModalOpen(true);
  };

  const stats = {
    total: filteredAppointments.length,
    enCurso: filteredAppointments.filter((a) => a.status === "En curso").length,
    finalizadas: filteredAppointments.filter((a) => a.status === "Finalizada").length,
  };

  const activeSpecialist = specialists.find((s) => s.id === filterSpecialist);

  return (
    <div data-testid="daily-agenda-page">
      <PageHeader
        eyebrow={activeSpecialist ? `CITAS DE ${activeSpecialist.name.toUpperCase()}` : "VISTA DIARIA"}
        title="Agenda"
        italic="del día"
        description={
          activeSpecialist
            ? `Citas asignadas a ${activeSpecialist.name} (${activeSpecialist.specialty}) para hoy.`
            : "Cuadrícula de horarios. Cada columna es un especialista, cada fila un bloque de 60 min."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              data-testid="header-floating-btn"
              onClick={() => setFloatingModalOpen(true)}
              className="btn-invert border border-black bg-sky-400 text-black px-4 py-3 font-mono-label text-[10px] hover:bg-black hover:text-white flex items-center gap-2"
            >
              <Wind className="w-3 h-3" strokeWidth={2} />
              Cita Flotante
            </button>
            <button
              data-testid="header-new-appointment-btn"
              onClick={openModalEmpty}
              className="btn-invert border border-black bg-black text-white px-6 py-3 font-mono-label text-[10px] hover:bg-white hover:text-black flex items-center gap-2"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Nueva Cita
            </button>
          </div>
        }
      />

      <SpecialistFilter
        specialists={specialists}
        value={filterSpecialist}
        onChange={setFilterSpecialist}
      />

      {/* Date picker strip */}
      <div className="px-6 lg:px-12 py-5 border-b border-neutral-200 flex items-center gap-4" data-testid="date-picker-strip">
        <Calendar className="w-3 h-3 text-neutral-500" strokeWidth={1.5} />
        <span className="font-mono-label text-[10px] text-neutral-500">Fecha</span>
        <input
          type="date"
          data-testid="agenda-date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-black px-3 py-2 bg-white font-mono-label text-xs outline-none focus:ring-1 focus:ring-black focus:ring-offset-2"
        />
        <button
          type="button"
          data-testid="agenda-today-btn"
          onClick={() => setDate(new Date().toISOString().slice(0, 10))}
          className="btn-invert border border-black px-3 py-2 font-mono-label text-[10px] hover:bg-black hover:text-white"
        >
          HOY
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-b border-black">
        {[
          { label: "Citas hoy", value: stats.total, testid: "stat-total" },
          { label: "En curso", value: stats.enCurso, testid: "stat-active" },
          { label: "Finalizadas", value: stats.finalizadas, testid: "stat-done" },
        ].map((s, i) => (
          <div
            key={s.label}
            data-testid={s.testid}
            className={`p-6 lg:p-8 ${i < 2 ? "border-r border-neutral-200" : ""}`}
          >
            <div className="font-mono-label text-[10px] text-neutral-500">{s.label}</div>
            <div className="font-serif-display text-5xl lg:text-6xl mt-2 leading-none">
              {String(s.value).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>

      {/* Excel-like timetable */}
      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs text-neutral-500">Cargando...</div>
        ) : visibleSpecialists.length === 0 ? (
          <div className="border border-black p-12 text-center" data-testid="empty-specialists">
            <div className="font-serif-display text-3xl mb-2">Sin especialistas</div>
            <p className="text-sm text-neutral-600">Agregue especialistas para visualizar la cuadrícula.</p>
          </div>
        ) : (
          <div
            className="border border-black overflow-auto max-h-[calc(100vh-260px)]"
            data-testid="agenda-grid-wrapper"
          >
            <table className="w-full border-collapse" data-testid="agenda-grid-table">
              <thead>
                <tr>
                  <th
                    className="sticky top-0 left-0 z-30 bg-white border-r border-b border-black p-3 text-left font-mono-label text-[10px] text-neutral-500 min-w-[80px]"
                  >
                    HORA
                  </th>
                  {visibleSpecialists.map((sp) => (
                    <th
                      key={sp.id}
                      data-testid={`col-header-${sp.id}`}
                      className="sticky top-0 z-20 bg-white border-r border-b border-black p-3 text-left min-w-[200px]"
                    >
                      <div className="flex items-center gap-2">
                        {sp.avatar_url ? (
                          <img
                            src={sp.avatar_url}
                            alt=""
                            className="w-8 h-8 object-cover grayscale border border-black/20"
                          />
                        ) : (
                          <span className="w-8 h-8 bg-neutral-200 flex items-center justify-center font-mono-label text-[9px] text-neutral-600">
                            {sp.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </span>
                        )}
                        <div className="leading-tight">
                          <div className="font-serif-display text-base">{sp.name}</div>
                          <div className="font-mono-label text-[9px] text-neutral-500">
                            {sp.specialty}
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h} data-testid={`row-hour-${h}`} className="align-top">
                    <td
                      className="sticky left-0 z-10 bg-white border-r border-b border-neutral-200 p-3 font-serif-display text-2xl text-neutral-400 leading-none"
                    >
                      {String(h).padStart(2, "0")}
                      <span className="text-xs align-top">:00</span>
                    </td>
                    {visibleSpecialists.map((sp) => {
                      const cell = grid[sp.id];
                      if (!cell) return null;
                      if (cell.coveredHours.has(h)) {
                        // covered by a previous-row appointment via rowSpan
                        return null;
                      }
                      const slots = cell.startsAt.get(h);
                      if (slots && slots.length > 0) {
                        const maxSpan = slots.reduce((m, x) => Math.max(m, x.span), 1);
                        return (
                          <td
                            key={sp.id}
                            rowSpan={maxSpan}
                            data-testid={`cell-${sp.id}-${h}`}
                            className="border-r border-b border-neutral-200 p-2"
                          >
                            <div className="flex flex-col gap-2 h-full">
                              {slots.map(({ appt: a }) => {
                                const sv = findService(a.service_id);
                                const styles = a.is_floating
                                  ? FLOATING_STYLES[a.status]
                                  : a.is_overbooked
                                  ? OVERBOOKED_STYLES[a.status]
                                  : STATUS_STYLES[a.status];
                                const serviceLabel = a.is_floating
                                  ? a.custom_service_name
                                  : (sv?.name || "—");
                                return (
                                  <div
                                    key={a.id}
                                    data-testid={`appointment-card-${a.id}`}
                                    onClick={() => setDetailAppt(a)}
                                    className={`group border-2 ${styles} p-3 flex-1 flex flex-col gap-2 transition-colors cursor-pointer min-h-0`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-mono-label text-[9px]">
                                        {a.start_time} — {a.end_time}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {a.is_floating && (
                                          <span
                                            data-testid={`floating-badge-${a.id}`}
                                            className="font-mono-label text-[8px] bg-sky-400 text-black px-1.5 py-0.5 border border-black"
                                          >
                                            FLOTANTE
                                          </span>
                                        )}
                                        {a.is_overbooked && !a.is_floating && (
                                          <span
                                            data-testid={`extra-badge-${a.id}`}
                                            className="font-mono-label text-[8px] bg-amber-400 text-black px-1.5 py-0.5 border border-black"
                                          >
                                            EXTRA
                                          </span>
                                        )}
                                        <span className="font-mono-label text-[9px] opacity-70">
                                          {a.status}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="font-serif-display text-lg leading-tight break-words">
                                      {a.client_name}
                                    </div>
                                    <div className="text-xs opacity-80 leading-snug">
                                      {serviceLabel}
                                    </div>
                                    {Array.isArray(a.additional_services) && a.additional_services.length > 0 && (
                                      <ul
                                        data-testid={`extras-list-${a.id}`}
                                        className="text-[11px] opacity-80 list-disc list-inside space-y-0.5 leading-tight pl-1"
                                      >
                                        {a.additional_services.map((ex, i) => (
                                          <li key={ex.id || `${ex.name}-${i}`} className="break-words">
                                            {ex.name}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div
                                      className="flex flex-wrap gap-1 mt-auto pt-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {a.status === "Confirmada" && (
                                        <button
                                          onClick={() => changeStatus(a.id, "En curso")}
                                          data-testid={`start-${a.id}`}
                                          className="btn-invert border border-current px-2 py-1 font-mono-label text-[9px] hover:bg-current hover:text-white flex items-center gap-1"
                                        >
                                          <Play className="w-2.5 h-2.5" strokeWidth={1.5} /> Iniciar
                                        </button>
                                      )}
                                      {a.status === "En curso" && (
                                        <button
                                          onClick={() => changeStatus(a.id, "Finalizada")}
                                          data-testid={`finish-${a.id}`}
                                          className="btn-invert border border-current px-2 py-1 font-mono-label text-[9px] hover:bg-white hover:text-black flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} />{" "}
                                          Finalizar
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDelete(a.id)}
                                        data-testid={`delete-${a.id}`}
                                        className="btn-invert border border-current/50 p-1 hover:bg-current hover:text-white"
                                        aria-label="Eliminar"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" strokeWidth={1.5} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={sp.id}
                          data-testid={`cell-${sp.id}-${h}`}
                          className="border-r border-b border-neutral-200 p-2 h-20"
                        >
                          {(() => {
                            const shiftStart = parseInt(sp.start_time.split(":")[0]);
                            const shiftEnd = parseInt(sp.end_time.split(":")[0]);
                            const outOfShift = h < shiftStart || h >= shiftEnd;
                            if (outOfShift) {
                              return (
                                <div
                                  data-testid={`out-of-shift-${sp.id}-${h}`}
                                  className="w-full h-full bg-neutral-50 border border-dashed border-neutral-100"
                                  aria-label="Fuera de turno"
                                />
                              );
                            }
                            return (
                              <button
                                type="button"
                                data-testid={`add-cell-${sp.id}-${h}`}
                                onClick={() => openModal(sp.id, h)}
                                className="w-full h-full flex items-center justify-center text-neutral-300 hover:text-black hover:bg-neutral-50 border border-dashed border-neutral-200 hover:border-black transition-colors"
                                aria-label={`Agendar ${sp.name} a las ${h}:00`}
                              >
                                <Plus className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            );
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewAppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
        specialists={specialists}
        specialistId={modalSpecialistId}
        startTime={modalStartTime}
        date={date}
      />

      <FloatingAppointmentModal
        open={floatingModalOpen}
        onClose={() => setFloatingModalOpen(false)}
        onCreated={load}
        specialists={specialists}
      />

      <AppointmentDetailModal
        open={!!detailAppt}
        onClose={() => setDetailAppt(null)}
        onUpdated={load}
        appointment={detailAppt}
        specialist={detailAppt ? findSpecialist(detailAppt.specialist_id) : null}
        service={detailAppt ? findService(detailAppt.service_id) : null}
      />
    </div>
  );
}
