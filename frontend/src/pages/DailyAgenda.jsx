import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import SpecialistFilter from "../components/SpecialistFilter";
import NewAppointmentModal from "../components/NewAppointmentModal";
import FloatingAppointmentModal from "../components/FloatingAppointmentModal";
import AppointmentDetailModal from "../components/AppointmentDetailModal";
import NewClientModal from "../components/NewClientModal";
import VacationModal from "../components/VacationModal";
import {
  fetchAppointments,
  fetchSpecialists,
  fetchServices,
  fetchVacations,
  deleteVacationDay,
  updateAppointmentStatus,
  deleteAppointment,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, Play, CheckCircle2, Calendar, Wind, UserPlus, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { SLOTS, timeToMin, minToTime, buildOverlapGrid } from "../lib/scheduling";

const STATUS_STYLES = {
  Confirmada: "bg-white border-black text-black",
  "En curso": "bg-black border-black text-white",
  Finalizada: "bg-neutral-200 border-neutral-500 text-neutral-700 line-through",
};

const OVERBOOKED_STYLES = {
  Confirmada: "bg-amber-50 border-black text-black border-dashed",
  "En curso": "bg-amber-100 border-black text-black border-dashed",
  Finalizada: "bg-amber-50 border-neutral-500 text-neutral-700 line-through border-dashed",
};

const FLOATING_STYLES = {
  Confirmada: "bg-sky-50 border-sky-800 text-black border-dashed",
  "En curso": "bg-sky-100 border-sky-800 text-black border-dashed",
  Finalizada: "bg-sky-50 border-neutral-500 text-neutral-700 line-through border-dashed",
};

export default function DailyAgenda() {
  const [appointments, setAppointments] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [services, setServices] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSpecialist, setFilterSpecialist] = useState("all");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [floatingModalOpen, setFloatingModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [modalSpecialistId, setModalSpecialistId] = useState("");
  const [modalStartTime, setModalStartTime] = useState("");
  const [detailAppt, setDetailAppt] = useState(null);
  const { branch } = useAuth();

  const load = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const [a, sp, sv, v] = await Promise.all([
        fetchAppointments({ date, branch_id: branch.id }),
        fetchSpecialists({ branch_id: branch.id }),
        fetchServices({ branch_id: branch.id }),
        fetchVacations({ date, branch_id: branch.id }),
      ]);
      setAppointments(a);
      setSpecialists(sp);
      setServices(sv);
      setVacations(v);
    } catch (e) {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [branch, date]);

  const findService = (id) => services.find((s) => s.id === id);
  const findSpecialist = (id) => specialists.find((s) => s.id === id);

  const getSpecialistVacation = (spId) => {
    return vacations.find(
      (v) => v.specialist_id === spId && v.start_date <= date && v.end_date >= date
    );
  };

  const handleCancelVacationForDay = async (vacation) => {
    if (!window.confirm(`¿Desea habilitar la agenda para el día ${date} manteniendo el resto de las vacaciones?`)) return;
    try {
      await deleteVacationDay(vacation.id, date);
      toast.success("Día habilitado correctamente");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cancelar el día de vacaciones");
    }
  };

  const visibleSpecialists = useMemo(() => {
    if (filterSpecialist === "all") return specialists;
    return specialists.filter((s) => s.id === filterSpecialist);
  }, [specialists, filterSpecialist]);

  const filteredAppointments = useMemo(() => {
    if (filterSpecialist === "all") return appointments;
    return appointments.filter((a) => a.specialist_id === filterSpecialist);
  }, [appointments, filterSpecialist]);

  const grid = useMemo(() => {
    const result = {};
    visibleSpecialists.forEach((sp) => {
      const apptsForSp = filteredAppointments.filter(
        (a) => a.specialist_id === sp.id
      );
      result[sp.id] = buildOverlapGrid(apptsForSp);
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

  const openModal = (specialistId, slotMin) => {
    const vac = getSpecialistVacation(specialistId);
    if (vac) {
      toast.error(`El especialista no está disponible hoy (${vac.reason || "Vacaciones"}).`);
      return;
    }
    setModalSpecialistId(specialistId);
    setModalStartTime(minToTime(slotMin));
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
            : "Cuadrícula de horarios. Cada columna es un especialista, cada fila un bloque de 30 min."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              data-testid="header-vacation-btn"
              onClick={() => setVacationModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <Palmtree className="w-3 h-3" strokeWidth={2} />
              Vacaciones
            </button>
            <button
              data-testid="header-save-client-btn"
              onClick={() => setClientModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-3 h-3" strokeWidth={2} />
              Guardar Cliente
            </button>
            <button
              data-testid="header-floating-btn"
              onClick={() => setFloatingModalOpen(true)}
              className="btn-invert border border-black bg-sky-400 text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white flex items-center gap-2 transition-colors"
            >
              <Wind className="w-3 h-3" strokeWidth={2} />
              Cita Flotante
            </button>
            <button
              data-testid="header-new-appointment-btn"
              onClick={openModalEmpty}
              className="btn-invert border border-black bg-black text-white px-6 py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black flex items-center gap-2 transition-colors"
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
      <div className="px-6 lg:px-12 py-5 border-b border-neutral-300 flex items-center gap-4" data-testid="date-picker-strip">
        <Calendar className="w-3.5 h-3.5 text-black" strokeWidth={2} />
        <span className="font-mono-label text-[10px] font-bold text-black">Fecha</span>
        <input
          type="date"
          data-testid="agenda-date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-black px-3 py-2 bg-white font-mono-label text-xs font-semibold text-black outline-none focus:ring-1 focus:ring-black focus:ring-offset-2"
        />
        <button
          type="button"
          data-testid="agenda-today-btn"
          onClick={() => setDate(new Date().toISOString().slice(0, 10))}
          className="btn-invert border border-black px-3 py-2 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white"
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
            className={`p-6 lg:p-8 ${i < 2 ? "border-r border-neutral-300" : ""}`}
          >
            <div className="font-mono-label text-[10px] font-bold text-neutral-800">{s.label}</div>
            <div className="font-serif-display text-5xl lg:text-6xl mt-2 leading-none text-black">
              {String(s.value).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>

      {/* Excel-like timetable */}
      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs font-bold text-black">Cargando...</div>
        ) : visibleSpecialists.length === 0 ? (
          <div className="border border-black p-12 text-center" data-testid="empty-specialists">
            <div className="font-serif-display text-3xl mb-2 text-black">Sin especialistas</div>
            <p className="text-sm font-medium text-neutral-700">Agregue especialistas para visualizar la cuadrícula.</p>
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
                    className="sticky top-0 left-0 z-30 bg-white border-r border-b border-black p-3 text-left font-mono-label text-[10px] font-bold text-black min-w-[90px]"
                  >
                    HORA
                  </th>
                  {visibleSpecialists.map((sp) => {
                    const vac = getSpecialistVacation(sp.id);
                    return (
                      <th
                        key={sp.id}
                        data-testid={`col-header-${sp.id}`}
                        className={`sticky top-0 z-20 border-r border-b border-black p-3 text-left min-w-[200px] ${
                          vac ? "bg-neutral-100" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {sp.avatar_url ? (
                            <img
                              src={sp.avatar_url}
                              alt=""
                              className="w-8 h-8 object-cover grayscale border border-black/40"
                            />
                          ) : (
                            <span className="w-8 h-8 bg-neutral-300 border border-black/20 flex items-center justify-center font-mono-label text-[9px] font-bold text-black">
                              {sp.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </span>
                          )}
                          <div className="leading-tight flex-1">
                            <div className="font-serif-display text-base text-black flex items-center gap-1.5">
                              {sp.name}
                            </div>
                            <div className="font-mono-label text-[9px] font-bold text-neutral-800">
                              {sp.specialty}
                            </div>
                          </div>
                        </div>

                        {/* Pastilla de vacaciones con botón de papelera para cancelar este día puntual */}
                        {vac && (
                          <div className="mt-2 flex items-center justify-between bg-neutral-200 border border-black/50 px-2 py-1">
                            <span className="font-mono-label text-[8px] font-bold uppercase truncate">
                              🌴 {vac.reason || "Vacaciones"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelVacationForDay(vac)}
                              title="Habilitar este día"
                              className="p-0.5 hover:text-red-600 transition-colors ml-1"
                            >
                              <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slotMin) => {
                  const timeLabel = minToTime(slotMin);
                  return (
                  <tr key={slotMin} data-testid={`row-slot-${timeLabel}`}>
                    <td
                      className="sticky left-0 z-10 bg-white border-r border-b border-neutral-300 p-3 font-serif-display text-2xl font-bold text-black leading-none whitespace-nowrap align-middle"
                    >
                      {timeLabel}
                    </td>
                    {visibleSpecialists.map((sp) => {
                      const vac = getSpecialistVacation(sp.id);

                      // Si está de vacaciones hoy, celda limpia de bloqueo
                      if (vac) {
                        return (
                          <td
                            key={sp.id}
                            className="border-r border-b border-neutral-300 p-1.5 h-10 bg-neutral-100/60 cursor-not-allowed select-none"
                            title={`${vac.reason || "Vacaciones"} (${vac.start_date} a ${vac.end_date})`}
                          >
                            <div className="w-full h-full border border-dashed border-neutral-300 flex items-center justify-center">
                              <span className="font-mono-label text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                                NO DISPONIBLE
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const cell = grid[sp.id];
                      if (!cell) return null;
                      if (cell.coveredSlots.has(slotMin)) {
                        return null;
                      }
                      const cluster = cell.startsAt.get(slotMin);
                      if (cluster && cluster.appts.length > 0) {
                        const maxSpan = cluster.span;
                        const groupCount = cluster.appts.length;
                        return (
                          <td
                            key={sp.id}
                            rowSpan={maxSpan}
                            data-testid={`cell-${sp.id}-${timeLabel}`}
                            className="border-r border-b border-neutral-300 p-1.5 relative h-1 align-stretch"
                          >
                            {groupCount > 1 && (
                              <span
                                data-testid={`cell-count-${sp.id}-${timeLabel}`}
                                className="absolute top-1 right-1 z-10 font-mono-label text-[8px] font-bold bg-black text-white px-1.5 py-0.5 border border-black"
                                aria-label={`${groupCount} citas en este bloque`}
                              >
                                ×{groupCount}
                              </span>
                            )}
                            <div className="flex flex-col gap-1.5 h-full w-full">
                              {cluster.appts.map((a) => {
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
                                    className={`group border-2 ${styles} p-3 flex-1 h-full w-full flex flex-col justify-between transition-colors cursor-pointer box-border`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono-label text-[9px] font-bold text-black">
                                          {a.start_time} — {a.end_time}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {a.is_floating && (
                                            <span
                                              data-testid={`floating-badge-${a.id}`}
                                              className="font-mono-label text-[8px] font-bold bg-sky-400 text-black px-1.5 py-0.5 border border-black"
                                            >
                                              FLOTANTE
                                            </span>
                                          )}
                                          {a.is_overbooked && !a.is_floating && (
                                            <span
                                              data-testid={`extra-badge-${a.id}`}
                                              className="font-mono-label text-[8px] font-bold bg-amber-400 text-black px-1.5 py-0.5 border border-black"
                                            >
                                              EXTRA
                                            </span>
                                          )}
                                          <span className="font-mono-label text-[9px] font-bold opacity-90">
                                            {a.status}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="font-serif-display text-lg font-bold leading-tight break-words text-black mt-1">
                                        {a.client_name}
                                      </div>
                                      <div className="text-xs font-semibold opacity-90 leading-snug mt-0.5">
                                        {serviceLabel}
                                      </div>
                                      {Array.isArray(a.additional_services) && a.additional_services.length > 0 && (
                                        <ul
                                          data-testid={`extras-list-${a.id}`}
                                          className="text-[11px] font-medium opacity-90 list-disc list-inside space-y-0.5 leading-tight pl-1 mt-1"
                                        >
                                          {a.additional_services.map((ex, i) => (
                                            <li key={ex.id || `${ex.name}-${i}`} className="break-words">
                                              {ex.name}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                    <div
                                      className="flex flex-wrap gap-1 mt-auto pt-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {a.status === "Confirmada" && (
                                        <button
                                          onClick={() => changeStatus(a.id, "En curso")}
                                          data-testid={`start-${a.id}`}
                                          className="btn-invert border border-current px-2 py-1 font-mono-label text-[9px] font-bold hover:bg-current hover:text-white flex items-center gap-1"
                                        >
                                          <Play className="w-2.5 h-2.5" strokeWidth={2} /> Iniciar
                                        </button>
                                      )}
                                      {a.status === "En curso" && (
                                        <button
                                          onClick={() => changeStatus(a.id, "Finalizada")}
                                          data-testid={`finish-${a.id}`}
                                          className="btn-invert border border-current px-2 py-1 font-mono-label text-[9px] font-bold hover:bg-white hover:text-black flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2} />{" "}
                                          Finalizar
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDelete(a.id)}
                                        data-testid={`delete-${a.id}`}
                                        className="btn-invert border border-current/70 p-1 hover:bg-current hover:text-white"
                                        aria-label="Eliminar"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
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
                          data-testid={`cell-${sp.id}-${timeLabel}`}
                          className="border-r border-b border-neutral-300 p-2 h-10"
                        >
                          {(() => {
                            const shiftStart = timeToMin(sp.start_time);
                            const shiftEnd = timeToMin(sp.end_time);
                            const outOfShift = slotMin < shiftStart || slotMin >= shiftEnd;
                            if (outOfShift) {
                              return (
                                <div
                                  data-testid={`out-of-shift-${sp.id}-${timeLabel}`}
                                  className="w-full h-full bg-neutral-100 border border-dashed border-neutral-300"
                                  aria-label="Fuera de turno"
                                />
                              );
                            }
                            return (
                              <button
                                type="button"
                                data-testid={`add-cell-${sp.id}-${timeLabel}`}
                                onClick={() => openModal(sp.id, slotMin)}
                                className="w-full h-full flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-100 border border-dashed border-neutral-300 hover:border-black transition-colors"
                                aria-label={`Agendar ${sp.name} a las ${timeLabel}`}
                              >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                              </button>
                            );
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
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

      <NewClientModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
      />

      <VacationModal
        open={vacationModalOpen}
        onClose={() => setVacationModalOpen(false)}
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
