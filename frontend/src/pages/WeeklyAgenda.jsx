import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import SpecialistFilter from "../components/SpecialistFilter";
import NewAppointmentModal from "../components/NewAppointmentModal";
import FloatingAppointmentModal from "../components/FloatingAppointmentModal";
import AppointmentDetailModal from "../components/AppointmentDetailModal";
import NewClientModal from "../components/NewClientModal";
import VacationModal from "../components/VacationModal";
import CoverageModal from "../components/CoverageModal";
import {
  fetchAppointments,
  fetchSpecialists,
  fetchServices,
  fetchVacations,
  fetchCoverages,
  deleteCoverage,
  deleteVacationDay,
  updateAppointmentStatus,
  deleteAppointment,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, Plus, Wind, UserPlus, Trash2, Play, CheckCircle2, Palmtree, Users } from "lucide-react";
import { toast } from "sonner";
import { SLOTS, minToTime, buildOverlapGrid } from "../lib/scheduling";

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // make Monday=0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAYS_ES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export default function WeeklyAgenda() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [allSpecialistsList, setAllSpecialistsList] = useState([]);
  const [services, setServices] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [coverages, setCoverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSpecialist, setFilterSpecialist] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [floatingModalOpen, setFloatingModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [coverageModalOpen, setCoverageModalOpen] = useState(false);
  const [modalSpecialistId, setModalSpecialistId] = useState("");
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [detailAppt, setDetailAppt] = useState(null);
  const { branch } = useAuth();

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const load = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const ws = weekStart.toISOString().slice(0, 10);
      const [a, sp, allSp, sv, v, cov] = await Promise.all([
        fetchAppointments({ week_start: ws, branch_id: branch.id }),
        fetchSpecialists({ branch_id: branch.id }),
        fetchSpecialists(),
        fetchServices({ branch_id: branch.id }),
        fetchVacations({ week_start: ws, branch_id: branch.id }),
        fetchCoverages({ week_start: ws, target_branch_id: branch.id }),
      ]);
      setAppointments(a);
      setSpecialists(sp);
      setAllSpecialistsList(allSp);
      setServices(sv);
      setVacations(v);
      setCoverages(cov);
    } catch { 
      toast.error("Error cargando datos"); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart, branch]);

  const goPrev = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
  };
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  // Consolidar especialistas de planta + apoyos/invitados que coincidan con la semana
  const activeSpecialistsList = useMemo(() => {
    const list = [...specialists];
    coverages.forEach((c) => {
      if (c.is_guest) {
        if (!list.some((s) => s.id === c.id)) {
          list.push({
            id: c.id,
            name: c.guest_name,
            specialty: c.specialty || "Invitada",
            start_time: c.start_time || "09:00",
            end_time: c.end_time || "18:00",
            is_coverage: true,
            coverage_id: c.id,
            reason: c.reason,
          });
        }
      } else if (c.specialist_id) {
        const found = allSpecialistsList.find((s) => s.id === c.specialist_id);
        if (found && !list.some((s) => s.id === found.id)) {
          list.push({
            ...found,
            is_coverage: true,
            coverage_id: c.id,
            reason: c.reason,
          });
        }
      }
    });
    return list;
  }, [specialists, coverages, allSpecialistsList]);

  const findSp = (id) => activeSpecialistsList.find((s) => s.id === id) || allSpecialistsList.find((s) => s.id === id);
  const findSv = (id) => services.find((s) => s.id === id);

  const isSpecialistOnVacation = (spId, dateStr) => {
    return vacations.find(
      (v) => v.specialist_id === spId && v.start_date <= dateStr && v.end_date >= dateStr
    );
  };

  const getDayVacations = (dateStr) => {
    return vacations.filter((v) => v.start_date <= dateStr && v.end_date >= dateStr);
  };

  const isSpecialistActiveOnDate = (sp, dateStr) => {
    if (!sp.is_coverage) return true;
    const cov = coverages.find(
      (c) => (c.id === sp.id || c.specialist_id === sp.id) &&
             c.start_date <= dateStr &&
             c.end_date >= dateStr
    );
    return !!cov;
  };

  const handleCancelVacationForDay = async (vacation, dateStr) => {
    if (!window.confirm(`¿Desea habilitar la agenda para el día ${dateStr} manteniendo el resto de las vacaciones?`)) return;
    try {
      await deleteVacationDay(vacation.id, dateStr);
      toast.success("Día habilitado correctamente");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cancelar el día de vacaciones");
    }
  };

  const grid = useMemo(() => {
    const result = {};
    days.forEach((d) => {
      const ds = d.toISOString().slice(0, 10);
      const apptsForDay = appointments.filter((a) => {
        if (a.date !== ds) return false;
        if (filterSpecialist !== "all" && a.specialist_id !== filterSpecialist) return false;
        return true;
      });
      result[ds] = buildOverlapGrid(apptsForDay);
    });
    return result;
  }, [appointments, days, filterSpecialist]);

  const fmtRange = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${f(weekStart)} — ${f(end)}`;
  };

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

  const openModalForCell = (dateStr, slotMin) => {
    if (filterSpecialist !== "all") {
      const sp = findSp(filterSpecialist);
      if (sp && !isSpecialistActiveOnDate(sp, dateStr)) {
        toast.error(`El estilista de apoyo no está programado para el día ${dateStr}.`);
        return;
      }
      const vac = isSpecialistOnVacation(filterSpecialist, dateStr);
      if (vac) {
        toast.error(`El especialista no está disponible (${vac.reason || "Vacaciones"}).`);
        return;
      }
    }
    setModalDate(dateStr);
    setModalStartTime(minToTime(slotMin));
    setModalSpecialistId(filterSpecialist !== "all" ? filterSpecialist : "");
    setModalOpen(true);
  };

  const openModalEmpty = () => {
    setModalDate(new Date().toISOString().slice(0, 10));
    setModalStartTime("");
    setModalSpecialistId("");
    setModalOpen(true);
  };

  return (
    <div data-testid="weekly-agenda-page">
      <PageHeader
        eyebrow="VISTA SEMANAL"
        title="Agenda"
        italic="semanal"
        description="Vista calendario de toda la semana. Navegue entre semanas con las flechas."
        action={
          <div className="flex items-center gap-2">
            <button
              data-testid="header-coverage-btn"
              onClick={() => setCoverageModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <Users className="w-3 h-3" strokeWidth={2} />
              Apoyo / Invitado
            </button>
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

      {/* Week navigation strip */}
      <div className="px-6 lg:px-12 py-5 border-b border-neutral-300 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} data-testid="week-prev"
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
          <button onClick={goToday} data-testid="week-today"
            className="btn-invert border border-black px-3 py-2 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white">
            HOY
          </button>
          <button onClick={goNext} data-testid="week-next"
            className="btn-invert border border-black p-2 hover:bg-black hover:text-white flex items-center justify-center">
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <div>
          <div className="font-mono-label text-[10px] font-bold text-neutral-800">SEMANA EN CURSO</div>
          <div className="font-serif-display text-2xl font-bold text-black" data-testid="week-range">{fmtRange()}</div>
        </div>
      </div>

      <SpecialistFilter
        specialists={activeSpecialistsList}
        value={filterSpecialist}
        onChange={setFilterSpecialist}
      />

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs font-bold text-black">Cargando semana...</div>
        ) : (
          <div className="border border-black overflow-auto max-h-[calc(100vh-260px)]" data-testid="weekly-grid-wrapper">
            <table className="w-full border-collapse" data-testid="weekly-grid">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-white border-b border-r border-black p-3 text-left font-mono-label text-[10px] font-bold text-black min-w-[90px]">
                    HORA
                  </th>
                  {days.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    const ds = d.toISOString().slice(0, 10);
                    const dayVacs = getDayVacations(ds);
                    const spVac = filterSpecialist !== "all" ? isSpecialistOnVacation(filterSpecialist, ds) : null;
                    const selectedSp = filterSpecialist !== "all" ? findSp(filterSpecialist) : null;
                    const isCoverageInactive = selectedSp?.is_coverage && !isSpecialistActiveOnDate(selectedSp, ds);

                    return (
                      <th key={i} className={`sticky top-0 z-20 border-b border-r border-black p-3 text-left min-w-[150px] ${
                        isToday ? "bg-black text-white" : (spVac || isCoverageInactive) ? "bg-neutral-100 text-black" : "bg-white text-black"
                      }`}>
                        <div className="font-mono-label text-[10px] font-bold opacity-80 flex items-center justify-between">
                          <span>{DAYS_ES[i]}</span>
                        </div>
                        <div className="font-serif-display text-2xl font-bold leading-none mt-1">{d.getDate()}</div>
                        
                        {/* Pastilla de vacaciones */}
                        {spVac && (
                          <div className="mt-2 flex items-center justify-between bg-neutral-200 border border-black/40 px-2 py-1">
                            <span className="font-mono-label text-[8px] font-bold uppercase truncate text-black">
                              🌴 {spVac.reason || "Vacaciones"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelVacationForDay(spVac, ds)}
                              title={`Habilitar el ${ds}`}
                              className="p-0.5 hover:text-red-600 transition-colors ml-1 text-black"
                            >
                              <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                          </div>
                        )}

                        {/* Pastilla si el apoyo no cubre este día */}
                        {isCoverageInactive && (
                          <div className="mt-2 bg-neutral-200/80 border border-black/20 px-2 py-0.5 text-center font-mono-label text-[8px] font-bold uppercase text-neutral-600">
                            SIN COBERTURA
                          </div>
                        )}

                        {dayVacs.length > 0 && filterSpecialist === "all" && (
                          <div className="font-mono-label text-[8px] font-bold text-neutral-600 truncate mt-1">
                            🌴 {dayVacs.length} Ausente{dayVacs.length > 1 ? "s" : ""}
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
                  <tr key={slotMin}>
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-neutral-300 p-3 font-serif-display text-2xl font-bold text-black leading-none whitespace-nowrap align-middle">
                      {timeLabel}
                    </td>
                    {days.map((d, i) => {
                      const ds = d.toISOString().slice(0, 10);
                      const spVac = filterSpecialist !== "all" ? isSpecialistOnVacation(filterSpecialist, ds) : null;
                      const selectedSp = filterSpecialist !== "all" ? findSp(filterSpecialist) : null;
                      const isCoverageInactive = selectedSp?.is_coverage && !isSpecialistActiveOnDate(selectedSp, ds);

                      // Si está de vacaciones o el apoyo no aplica para este día
                      if (spVac || isCoverageInactive) {
                        return (
                          <td
                            key={i}
                            className="border-b border-r border-neutral-300 p-1.5 h-10 bg-neutral-100/60 cursor-not-allowed select-none"
                            title={spVac ? `${spVac.reason || "Vacaciones"}` : "Estilista fuera de periodo de apoyo"}
                          >
                            <div className="w-full h-full border border-dashed border-neutral-300 flex items-center justify-center">
                              <span className="font-mono-label text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                                NO DISPONIBLE
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const bucket = grid[ds];
                      if (!bucket) {
                        return (
                          <td key={i} className="border-b border-r border-neutral-300 p-2 h-10" />
                        );
                      }
                      if (bucket.coveredSlots.has(slotMin)) return null;
                      const cluster = bucket.startsAt.get(slotMin);
                      const apptList = cluster ? cluster.appts : [];
                      const maxSpan = cluster ? cluster.span : 0;
                      const groupCount = apptList.length;

                      if (groupCount > 0) {
                        return (
                          <td
                            key={i}
                            rowSpan={maxSpan || 1}
                            className="border-b border-r border-neutral-300 p-1.5 relative h-1 align-stretch"
                            data-testid={`week-cell-${ds}-${timeLabel}`}
                          >
                            {groupCount > 1 && (
                              <span
                                data-testid={`week-cell-count-${ds}-${timeLabel}`}
                                className="absolute top-1 right-1 z-10 font-mono-label text-[8px] font-bold bg-black text-white px-1.5 py-0.5 border border-black"
                              >
                                ×{groupCount}
                              </span>
                            )}
                            <div className="flex flex-col gap-1.5 h-full w-full">
                              {apptList.map((a) => {
                                const sv = findSv(a.service_id);
                                const sp = findSp(a.specialist_id);
                                const cls = a.is_floating
                                  ? "bg-sky-50 border-2 border-sky-800 border-dashed text-black"
                                  : a.is_overbooked
                                  ? "bg-amber-50 border-2 border-black border-dashed text-black"
                                  : a.status === "En curso"
                                  ? "bg-black border-2 border-black text-white"
                                  : a.status === "Finalizada"
                                  ? "bg-neutral-200 border-2 border-neutral-500 text-neutral-700 line-through"
                                  : "bg-white border-2 border-black text-black";
                                const serviceLabel = a.is_floating
                                  ? a.custom_service_name
                                  : (sv?.name || "—");
                                return (
                                  <div
                                    key={a.id}
                                    data-testid={`week-appt-${a.id}`}
                                    onClick={() => setDetailAppt(a)}
                                    className={`${cls} p-2.5 flex-1 h-full w-full flex flex-col justify-between transition-colors cursor-pointer box-border`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-mono-label text-[9px] font-bold">
                                          {a.start_time}–{a.end_time}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {a.is_floating && (
                                            <span className="font-mono-label text-[7px] font-bold bg-sky-400 text-black px-1 border border-black">
                                              FLOT
                                            </span>
                                          )}
                                          {a.is_overbooked && !a.is_floating && (
                                            <span
                                              data-testid={`extra-badge-${a.id}`}
                                              className="font-mono-label text-[7px] font-bold bg-amber-400 text-black px-1 border border-black"
                                            >
                                              EXTRA
                                            </span>
                                          )}
                                          <span className="font-mono-label text-[8px] font-bold opacity-90">
                                            {a.status}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="font-serif-display text-base font-bold leading-tight break-words mt-1">
                                        {a.client_name}
                                      </div>
                                      <div className="text-[10px] font-semibold opacity-90 leading-tight uppercase mt-0.5">
                                        {serviceLabel}
                                      </div>
                                    </div>
                                    <div className="mt-auto pt-2">
                                      {sp && (
                                        <div className="font-mono-label text-[8px] font-bold opacity-90 uppercase mb-1.5 flex items-center justify-between">
                                          <span>{sp.name}</span>
                                          {sp.is_coverage && (
                                            <span className="bg-black text-white px-1 py-0.2 text-[7px]">
                                              {sp.reason || "APOYO"}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div
                                        className="flex flex-wrap gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {a.status === "Confirmada" && (
                                          <button
                                            onClick={() => changeStatus(a.id, "En curso")}
                                            data-testid={`week-start-${a.id}`}
                                            className="btn-invert border border-current px-1.5 py-0.5 font-mono-label text-[8px] font-bold hover:bg-current hover:text-white flex items-center gap-0.5"
                                          >
                                            <Play className="w-2 h-2" strokeWidth={2} /> Iniciar
                                          </button>
                                        )}
                                        {a.status === "En curso" && (
                                          <button
                                            onClick={() => changeStatus(a.id, "Finalizada")}
                                            data-testid={`week-finish-${a.id}`}
                                            className="btn-invert border border-current px-1.5 py-0.5 font-mono-label text-[8px] font-bold hover:bg-white hover:text-black flex items-center gap-0.5"
                                          >
                                            <CheckCircle2 className="w-2 h-2" strokeWidth={2} /> Finalizar
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDelete(a.id)}
                                          data-testid={`week-delete-${a.id}`}
                                          className="btn-invert border border-current/70 p-1 hover:bg-current hover:text-white"
                                          aria-label="Eliminar"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
                                        </button>
                                      </div>
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
                          key={i}
                          data-testid={`week-cell-${ds}-${timeLabel}`}
                          className="border-b border-r border-neutral-300 p-2 h-10"
                        >
                          <button
                            type="button"
                            onClick={() => openModalForCell(ds, slotMin)}
                            className="w-full h-full flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-100 border border-dashed border-neutral-300 hover:border-black transition-colors"
                            aria-label={`Agendar ${ds} a las ${timeLabel}`}
                          >
                            <Plus className="w-4 h-4" strokeWidth={2} />
                          </button>
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
        specialists={activeSpecialistsList}
        specialistId={modalSpecialistId}
        startTime={modalStartTime}
        date={modalDate}
      />

      <FloatingAppointmentModal
        open={floatingModalOpen}
        onClose={() => setFloatingModalOpen(false)}
        onCreated={load}
        specialists={activeSpecialistsList}
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

      <CoverageModal
        open={coverageModalOpen}
        onClose={() => setCoverageModalOpen(false)}
        onCreated={load}
      />

      <AppointmentDetailModal
        open={!!detailAppt}
        onClose={() => setDetailAppt(null)}
        onUpdated={load}
        appointment={detailAppt}
        specialist={detailAppt ? findSp(detailAppt.specialist_id) : null}
        service={detailAppt ? findSv(detailAppt.service_id) : null}
      />
    </div>
  );
}
