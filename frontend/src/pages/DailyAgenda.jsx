import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import SpecialistFilter from "../components/SpecialistFilter";
import NewAppointmentModal from "../components/NewAppointmentModal";
import FloatingAppointmentModal from "../components/FloatingAppointmentModal";
import AppointmentDetailModal from "../components/AppointmentDetailModal";
import NewClientModal from "../components/NewClientModal";
import VacationModal from "../components/VacationModal";
import CoverageModal from "../components/CoverageModal";
import BlockScheduleModal from "../components/BlockScheduleModal";
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
import { Plus, Wind, UserPlus, Trash2, Play, CheckCircle2, Palmtree, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { SLOTS, timeToMin, minToTime, buildOverlapGrid } from "../lib/scheduling";

const BLOCK_STYLES = "bg-neutral-900 border-2 border-black text-white";

const PHYSICAL_ORDER_PROVIDENCIA = [
  "manuel",
  "claudia",
  "veronica",
  "verónica",
  "joel",
  "velia",
  "rodolfo",
  "angel",
  "ángel",
  "jaime",
  "cristina",
  "ellyn",
];

export default function DailyAgenda() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
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
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [modalSpecialistId, setModalSpecialistId] = useState("");
  const [modalStartTime, setModalStartTime] = useState("");
  const [detailAppt, setDetailAppt] = useState(null);
  const { branch } = useAuth();

  const load = async () => {
    if (!branch) return;
    setLoading(true);
    try {
      const [a, sp, allSp, sv, v, cov] = await Promise.all([
        fetchAppointments({ date: selectedDate, branch_id: branch.id }),
        fetchSpecialists({ branch_id: branch.id }),
        fetchSpecialists(),
        fetchServices({ branch_id: branch.id }),
        fetchVacations({ date: selectedDate, branch_id: branch.id }),
        fetchCoverages({ date: selectedDate, target_branch_id: branch.id }),
      ]);
      setAppointments(a || []);
      setSpecialists(sp || []);
      setAllSpecialistsList(allSp || []);
      setServices(sv || []);
      setVacations(v || []);
      setCoverages(cov || []);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [selectedDate, branch]);

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

    const isProvidencia = (branch?.name || "")
      .toLowerCase()
      .includes("providencia");

    if (isProvidencia) {
      return list.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        const idxA = PHYSICAL_ORDER_PROVIDENCIA.findIndex((k) =>
          nameA.includes(k)
        );
        const idxB = PHYSICAL_ORDER_PROVIDENCIA.findIndex((k) =>
          nameB.includes(k)
        );
        const rankA = idxA === -1 ? 999 : idxA;
        const rankB = idxB === -1 ? 999 : idxB;

        if (rankA !== rankB) return rankA - rankB;
        return nameA.localeCompare(nameB);
      });
    }

    return list.sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : 999;
      const orderB = typeof b.order === "number" ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [specialists, coverages, allSpecialistsList, branch]);

  const displayedSpecialists = useMemo(() => {
    if (filterSpecialist === "all") return activeSpecialistsList;
    return activeSpecialistsList.filter((s) => s.id === filterSpecialist);
  }, [activeSpecialistsList, filterSpecialist]);

  const findSp = (id) =>
    activeSpecialistsList.find((s) => s.id === id) ||
    allSpecialistsList.find((s) => s.id === id);
  const findSv = (id) => services.find((s) => s.id === id);

  const isSpecialistOnVacation = (spId) => {
    return vacations.find((v) => v.specialist_id === spId);
  };

  const isSpecialistActiveOnDate = (sp) => {
    if (!sp.is_coverage) return true;
    const cov = coverages.find(
      (c) =>
        (c.id === sp.id || c.specialist_id === sp.id) &&
        c.start_date <= selectedDate &&
        c.end_date >= selectedDate
    );
    return !!cov;
  };

  const handleCancelVacation = async (vacation) => {
    if (
      !window.confirm(
        `¿Desea habilitar la agenda para el día ${selectedDate} manteniendo el resto de las vacaciones?`
      )
    )
      return;
    try {
      await deleteVacationDay(vacation.id, selectedDate);
      toast.success("Día habilitado correctamente");
      load();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "No se pudo cancelar el día de vacaciones"
      );
    }
  };

  const handleCancelCoverage = async (coverageId) => {
    if (!window.confirm("¿Eliminar este registro de apoyo/invitado?")) return;
    try {
      await deleteCoverage(coverageId);
      toast.success("Registro de apoyo eliminado");
      load();
    } catch {
      toast.error("No se pudo eliminar el apoyo");
    }
  };

  const grid = useMemo(() => {
    const result = {};
    displayedSpecialists.forEach((sp) => {
      const apptsForSp = appointments.filter((a) => a.specialist_id === sp.id);
      result[sp.id] = buildOverlapGrid(apptsForSp);
    });
    return result;
  }, [appointments, displayedSpecialists]);

  const changeStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      toast.success(`Cita ${status.toLowerCase()}`);
      load();
    } catch {
      toast.error("No se pudo actualizar el estado");
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

  const counts = useMemo(() => {
    let total = appointments.length;
    let enCurso = 0;
    let finalizadas = 0;
    appointments.forEach((a) => {
      if (a.status === "En curso") enCurso++;
      if (a.status === "Finalizada") finalizadas++;
    });
    return { total, enCurso, finalizadas };
  }, [appointments]);

  const openCell = (spId, slotMin) => {
    const sp = findSp(spId);
    if (sp && !isSpecialistActiveOnDate(sp)) {
      toast.error(
        `El estilista de apoyo no está programado para el día ${selectedDate}.`
      );
      return;
    }
    const vac = isSpecialistOnVacation(spId);
    if (vac && (!vac.start_time || !vac.end_time)) {
      toast.error(
        `El especialista está ausente (${vac.reason || "Vacaciones"}).`
      );
      return;
    }
    setModalSpecialistId(spId);
    setModalStartTime(minToTime(slotMin));
    setModalOpen(true);
  };

  const openEmpty = () => {
    setModalSpecialistId("");
    setModalStartTime("");
    setModalOpen(true);
  };

  const selectedSpecialistObj =
    filterSpecialist !== "all" ? findSp(filterSpecialist) : null;

  return (
    <div data-testid="daily-agenda-page">
      <PageHeader
        eyebrow={
          selectedSpecialistObj
            ? `CITAS DE ${selectedSpecialistObj.name.toUpperCase()}`
            : "TODOS LOS ESPECIALISTAS"
        }
        title="Agenda"
        italic="del día"
        description={
          selectedSpecialistObj
            ? `Citas asignadas a ${selectedSpecialistObj.name} para hoy.`
            : "Visualización completa de citas programadas por especialista."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBlockModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <Clock className="w-3 h-3" strokeWidth={2} />
              Descanso / Capacitación
            </button>
            <button
              onClick={() => setCoverageModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <Users className="w-3 h-3" strokeWidth={2} />
              Apoyo / Invitado
            </button>
            <button
              onClick={() => setVacationModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <Palmtree className="w-3 h-3" strokeWidth={2} />
              Vacaciones
            </button>
            <button
              onClick={() => setClientModalOpen(true)}
              className="btn-invert border border-black bg-white text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-neutral-100 flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-3 h-3" strokeWidth={2} />
              Guardar Cliente
            </button>
            <button
              onClick={() => setFloatingModalOpen(true)}
              className="btn-invert border border-black bg-sky-400 text-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white flex items-center gap-2 transition-colors"
            >
              <Wind className="w-3 h-3" strokeWidth={2} />
              Cita Flotante
            </button>
            <button
              onClick={openEmpty}
              className="btn-invert border border-black bg-black text-white px-6 py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black flex items-center gap-2 transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Nueva Cita
            </button>
          </div>
        }
      />

      <SpecialistFilter
        specialists={activeSpecialistsList}
        value={filterSpecialist}
        onChange={setFilterSpecialist}
      />

      <div className="px-6 lg:px-12 py-4 border-b border-neutral-300 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono-label text-[10px] font-bold text-black uppercase">
            Fecha
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-black px-3 py-1.5 font-mono-label text-xs bg-white text-black focus:outline-none"
          />
          <button
            onClick={() =>
              setSelectedDate(new Date().toISOString().slice(0, 10))
            }
            className="btn-invert border border-black px-3 py-1.5 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white"
          >
            HOY
          </button>
        </div>
      </div>

      {/* Metric Counters Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-neutral-300 divide-y md:divide-y-0 md:divide-x divide-neutral-300">
        <div className="p-6">
          <div className="font-mono-label text-[10px] font-bold text-neutral-800">
            CITAS HOY
          </div>
          <div className="font-serif-display text-4xl font-bold text-black mt-1">
            {String(counts.total).padStart(2, "0")}
          </div>
        </div>
        <div className="p-6">
          <div className="font-mono-label text-[10px] font-bold text-neutral-800">
            EN CURSO
          </div>
          <div className="font-serif-display text-4xl font-bold text-black mt-1">
            {String(counts.enCurso).padStart(2, "0")}
          </div>
        </div>
        <div className="p-6">
          <div className="font-mono-label text-[10px] font-bold text-neutral-800">
            FINALIZADAS
          </div>
          <div className="font-serif-display text-4xl font-bold text-black mt-1">
            {String(counts.finalizadas).padStart(2, "0")}
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs font-bold text-black">
            Cargando citas...
          </div>
        ) : (
          <div className="border border-black overflow-auto max-h-[calc(100vh-320px)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-white border-b border-r border-black p-3 text-left font-mono-label text-[10px] font-bold text-black min-w-[90px]">
                    HORA
                  </th>
                  {displayedSpecialists.map((sp) => {
                    const vac = isSpecialistOnVacation(sp.id);
                    const isCoverageInactive =
                      sp.is_coverage && !isSpecialistActiveOnDate(sp);

                    return (
                      <th
                        key={sp.id}
                        className={`sticky top-0 z-20 border-b border-r border-black p-3 text-left min-w-[170px] ${
                          sp.is_coverage
                            ? "bg-amber-50 text-black"
                            : "bg-white text-black"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-neutral-200 border border-black flex items-center justify-center font-mono-label text-xs font-bold">
                            {sp.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-serif-display text-sm font-bold text-black leading-tight flex items-center gap-1">
                              {sp.name}
                              {sp.is_coverage && (
                                <span className="font-mono-label text-[8px] bg-black text-white px-1 py-0.2">
                                  {sp.reason || "APOYO"}
                                </span>
                              )}
                            </div>
                            <div className="font-mono-label text-[9px] text-neutral-600 uppercase">
                              {sp.specialty}
                            </div>
                          </div>
                        </div>

                        {/* Pastilla de Ausencia / Vacaciones de todo el día */}
                        {vac && (!vac.start_time || !vac.end_time) && (
                          <div className="mt-2 flex items-center justify-between bg-neutral-200 border border-black/40 px-2 py-1">
                            <span className="font-mono-label text-[8px] font-bold uppercase truncate text-black">
                              🌴 {vac.reason || "Vacaciones"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelVacation(vac)}
                              title="Habilitar día"
                              className="p-0.5 hover:text-red-600 transition-colors ml-1 text-black"
                            >
                              <Trash2 className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                          </div>
                        )}

                        {/* Pastilla de Inactividad si es Apoyo */}
                        {isCoverageInactive && (
                          <div className="mt-2 flex items-center justify-between bg-neutral-200 border border-black/40 px-2 py-1">
                            <span className="font-mono-label text-[8px] font-bold uppercase truncate text-black">
                              SIN COBERTURA HOY
                            </span>
                            {sp.coverage_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCancelCoverage(sp.coverage_id)
                                }
                                title="Eliminar registro de apoyo"
                                className="p-0.5 hover:text-red-600 transition-colors ml-1 text-black"
                              >
                                <Trash2
                                  className="w-2.5 h-2.5"
                                  strokeWidth={2}
                                />
                              </button>
                            )}
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
                      {displayedSpecialists.map((sp) => {
                        const vac = isSpecialistOnVacation(sp.id);
                        const isCoverageInactive =
                          sp.is_coverage && !isSpecialistActiveOnDate(sp);

                        const isFullDayVacation =
                          vac && (!vac.start_time || !vac.end_time);

                        if (isCoverageInactive || isFullDayVacation) {
                          return (
                            <td
                              key={sp.id}
                              className="border-b border-r border-neutral-300 p-1.5 h-10 bg-neutral-100/60 cursor-not-allowed select-none"
                            >
                              <div className="w-full h-full border border-dashed border-neutral-300 flex items-center justify-center">
                                <span className="font-mono-label text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                                  {isCoverageInactive
                                    ? "SIN COBERTURA"
                                    : "🌴 AUSENTE"}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const bucket = grid[sp.id];
                        if (!bucket) return <td key={sp.id} className="border-b border-r border-neutral-300 p-2 h-10" />;
                        if (bucket.coveredSlots.has(slotMin)) return null;

                        const cluster = bucket.startsAt.get(slotMin);
                        const apptList = cluster ? cluster.appts : [];
                        const maxSpan = cluster ? cluster.span : 0;
                        const groupCount = apptList.length;

                        if (groupCount > 0) {
                          return (
                            <td
                              key={sp.id}
                              rowSpan={maxSpan || 1}
                              className="border-b border-r border-neutral-300 p-1.5 relative h-1 align-stretch"
                            >
                              {groupCount > 1 && (
                                <span className="absolute top-1 right-1 z-10 font-mono-label text-[8px] font-bold bg-black text-white px-1.5 py-0.5 border border-black">
                                  ×{groupCount}
                                </span>
                              )}
                              <div className="flex flex-col gap-1.5 h-full w-full">
                                {apptList.map((a) => {
                                  const sv = findSv(a.service_id);
                                  const isBlock =
                                    a.client_name?.includes("DESCANSO") ||
                                    a.client_name?.includes("CAPACITACIÓN");

                                  const cls = isBlock
                                    ? BLOCK_STYLES
                                    : a.is_floating
                                    ? "bg-sky-50 border-2 border-sky-800 border-dashed text-black"
                                    : a.is_overbooked
                                    ? "bg-amber-50 border-2 border-black border-dashed text-black"
                                    : a.status === "En curso"
                                    ? "bg-black border-2 border-black text-white"
                                    : a.status === "Finalizada"
                                    ? "bg-neutral-200 border-2 border-neutral-500 text-neutral-700 line-through"
                                    : "bg-white border-2 border-black text-black";

                                  const serviceLabel = isBlock
                                    ? a.custom_service_name || "HORARIO BLOQUEADO"
                                    : a.is_floating
                                    ? a.custom_service_name
                                    : sv?.name || "—";

                                  return (
                                    <div
                                      key={a.id}
                                      onClick={() => setDetailAppt(a)}
                                      className={`${cls} p-2.5 flex-1 h-full w-full flex flex-col justify-between transition-colors cursor-pointer box-border`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-mono-label text-[9px] font-bold">
                                            {a.start_time} — {a.end_time}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {isBlock && (
                                              <span className="font-mono-label text-[7px] font-bold bg-white text-black px-1 border border-black">
                                                BLOQUEO
                                              </span>
                                            )}
                                            {a.is_floating && (
                                              <span className="font-mono-label text-[7px] font-bold bg-sky-400 text-black px-1 border border-black">
                                                FLOT
                                              </span>
                                            )}
                                            {a.is_overbooked && !a.is_floating && !isBlock && (
                                              <span className="font-mono-label text-[7px] font-bold bg-amber-400 text-black px-1 border border-black">
                                                EXTRA
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="font-serif-display text-base font-bold leading-tight break-words mt-1">
                                          {a.client_name}
                                        </div>
                                        <div className="text-[10px] font-semibold opacity-90 leading-tight uppercase mt-0.5">
                                          {serviceLabel}
                                        </div>
                                      </div>
                                      <div
                                        className="mt-auto pt-2 flex flex-wrap gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {!isBlock && a.status === "Confirmada" && (
                                          <button
                                            onClick={() =>
                                              changeStatus(a.id, "En curso")
                                            }
                                            className="btn-invert border border-current px-1.5 py-0.5 font-mono-label text-[8px] font-bold hover:bg-current hover:text-white flex items-center gap-0.5"
                                          >
                                            <Play
                                              className="w-2 h-2"
                                              strokeWidth={2}
                                            />{" "}
                                            Iniciar
                                          </button>
                                        )}
                                        {!isBlock && a.status === "En curso" && (
                                          <button
                                            onClick={() =>
                                              changeStatus(a.id, "Finalizada")
                                            }
                                            className="btn-invert border border-current px-1.5 py-0.5 font-mono-label text-[8px] font-bold hover:bg-white hover:text-black flex items-center gap-0.5"
                                          >
                                            <CheckCircle2
                                              className="w-2 h-2"
                                              strokeWidth={2}
                                            />{" "}
                                            Finalizar
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDelete(a.id)}
                                          className="btn-invert border border-current/70 p-1 hover:bg-current hover:text-white"
                                          aria-label="Eliminar"
                                        >
                                          <Trash2
                                            className="w-2.5 h-2.5"
                                            strokeWidth={2}
                                          />
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
                            className="border-b border-r border-neutral-300 p-2 h-10"
                          >
                            <button
                              type="button"
                              onClick={() => openCell(sp.id, slotMin)}
                              className="w-full h-full flex items-center justify-center text-neutral-500 hover:text-black hover:bg-neutral-100 border border-dashed border-neutral-300 hover:border-black transition-colors"
                              aria-label={`Agendar a las ${timeLabel}`}
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
        date={selectedDate}
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

      <BlockScheduleModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onCreated={load}
        specialists={activeSpecialistsList}
        date={selectedDate}
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
