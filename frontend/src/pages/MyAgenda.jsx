import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchAppointments, fetchServices } from "../lib/api";
import { LogOut, Clock, ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { SLOTS, minToTime, buildOverlapGrid } from "../lib/scheduling";

// SLOTS / minToTime imported from ../lib/scheduling
const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const STATUS_STYLES = {
  Confirmada: "bg-white border-black text-black",
  "En curso": "bg-black border-black text-white",
  Finalizada: "bg-neutral-100 border-neutral-300 text-neutral-500 line-through",
};

export default function MyAgenda() {
  const { specialist, clearSpecialist } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("day"); // 'day' | 'week'
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!specialist) return;
    setLoading(true);
    try {
      const params = view === "day"
        ? { date: today }
        : { week_start: weekStart.toISOString().slice(0, 10) };
      const [a, sv] = await Promise.all([
        fetchAppointments(params),
        fetchServices(specialist?.branch_id ? { branch_id: specialist.branch_id } : {}),
      ]);
      setAppointments(a.filter((x) => x.specialist_id === specialist.id));
      setServices(sv);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [view, weekStart, specialist]);

  const handleLogout = () => {
    navigate("/", { replace: true });
    setTimeout(() => clearSpecialist(), 0);
  };

  const findService = (id) => services.find((s) => s.id === id);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
    }),
    [weekStart]
  );

  // Per-day overlap grid for week view
  const weekGrid = useMemo(() => {
    const result = {};
    days.forEach((d) => {
      const ds = d.toISOString().slice(0, 10);
      result[ds] = buildOverlapGrid(appointments.filter((a) => a.date === ds));
    });
    return result;
  }, [appointments, days]);

  const fmtRange = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${f(weekStart)} — ${f(end)}`;
  };

  if (!specialist) return null;

  return (
    <div className="min-h-screen bg-white max-w-full overflow-x-hidden" data-testid="my-agenda-page">
      {/* Top bar */}
      <header className="border-b border-black px-6 lg:px-12 py-6 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          {specialist.avatar_url ? (
            <img src={specialist.avatar_url} alt="" className="w-14 h-14 object-cover grayscale border border-black" />
          ) : (
            <div className="w-14 h-14 bg-neutral-200 flex items-center justify-center font-serif-display text-2xl font-bold text-black border border-black">
              {specialist.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
          )}
          <div>
            <div className="font-mono-label text-[10px] font-bold text-black">ESPECIALISTA</div>
            <div className="font-serif-display text-3xl font-bold leading-none mt-1 text-black" data-testid="my-name">{specialist.name}</div>
            <div className="text-xs font-semibold text-neutral-800 mt-1">{specialist.specialty} · {specialist.start_time}—{specialist.end_time}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="my-logout-btn"
          className="btn-invert border border-black px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={2} /> Salir
        </button>
      </header>

      {/* View toggle */}
      <div className="border-b border-black flex bg-white">
        <button
          data-testid="my-view-day"
          onClick={() => setView("day")}
          className={`btn-invert px-6 py-4 font-mono-label text-[10px] font-bold border-r border-neutral-300 flex items-center gap-2 ${
            view === "day" ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
          }`}
        >
          <CalendarDays className="w-4 h-4" strokeWidth={2} /> Hoy
        </button>
        <button
          data-testid="my-view-week"
          onClick={() => setView("week")}
          className={`btn-invert px-6 py-4 font-mono-label text-[10px] font-bold border-r border-neutral-300 flex items-center gap-2 ${
            view === "week" ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
          }`}
        >
          <CalendarRange className="w-4 h-4" strokeWidth={2} /> Semana
        </button>
        <div className="flex-1" />
        {view === "week" && (
          <div className="flex items-center gap-1 px-3">
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
              data-testid="my-week-prev"
              className="btn-invert border border-black h-9 w-9 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <span className="font-serif-display text-base font-bold text-black px-3" data-testid="my-week-range">{fmtRange()}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
              data-testid="my-week-next"
              className="btn-invert border border-black h-9 w-9 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 lg:p-12">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs font-bold text-black">Cargando...</div>
        ) : view === "day" ? (
          appointments.length === 0 ? (
            <div className="border border-black p-12 text-center bg-white" data-testid="my-empty-day">
              <div className="font-serif-display text-3xl font-bold mb-2 text-black">Sin citas asignadas hoy</div>
              <p className="text-sm font-semibold text-neutral-700">Disfrute su día.</p>
            </div>
          ) : (
            <div data-testid="my-day-timeline">
              <div className="font-mono-label text-[10px] font-bold text-black mb-4">
                {appointments.length} CITA{appointments.length !== 1 ? "S" : ""} HOY
              </div>
              {(() => {
                const dayGrid = buildOverlapGrid(appointments);
                const ROW_H = 96; // px per 30-min slot
                return SLOTS.map((slotMin) => {
                  const hh = Math.floor(slotMin / 60);
                  const mm = slotMin % 60;
                  const cluster = dayGrid.startsAt.get(slotMin);
                  return (
                    <div
                      key={slotMin}
                      style={{ height: ROW_H }}
                      className="relative grid grid-cols-[80px_1fr] gap-6 border-t border-neutral-300 first:border-t-0"
                      data-testid={`my-day-row-${minToTime(slotMin)}`}
                    >
                      <div className="font-serif-display text-3xl font-bold text-black leading-none pt-3">
                        {String(hh).padStart(2, "0")}<span className="text-base align-top">:{String(mm).padStart(2, "0")}</span>
                      </div>
                      <div className="relative">
                        {cluster && cluster.appts.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 0,
                              right: 0,
                              height: cluster.span * ROW_H - 12,
                            }}
                            className="flex flex-col gap-2 z-10"
                          >
                            {cluster.appts.map((a) => {
                              const sv = findService(a.service_id);
                              const serviceLabel = a.is_floating
                                ? a.custom_service_name
                                : (sv?.name || "—");
                              
                              const isShortSlot = cluster.span === 1;

                              return (
                                <div
                                  key={a.id}
                                  data-testid={`my-appt-${a.id}`}
                                  className={`border ${STATUS_STYLES[a.status]} ${
                                    isShortSlot ? "px-3 py-2" : "p-4"
                                  } flex-1 min-h-0 overflow-hidden flex flex-col justify-between`}
                                >
                                  <div className="min-h-0 flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                                      <span className="font-mono-label text-[9px] font-bold">
                                        {a.start_time} — {a.end_time} · {a.status}
                                      </span>
                                      {a.is_floating && (
                                        <span className="font-mono-label text-[7px] font-bold bg-sky-400 text-black px-1 py-0.2 border border-black">
                                          FLOTANTE
                                        </span>
                                      )}
                                      {a.is_overbooked && !a.is_floating && (
                                        <span className="font-mono-label text-[7px] font-bold bg-amber-400 text-black px-1 py-0.2 border border-black">
                                          EXTRA
                                        </span>
                                      )}
                                    </div>
                                    <div className={`font-serif-display font-bold leading-none truncate ${
                                      isShortSlot ? "text-lg lg:text-xl my-0.5" : "text-2xl lg:text-3xl my-1"
                                    }`}>
                                      {a.client_name}
                                    </div>
                                    <div className="font-mono-label text-[9px] lg:text-[10px] font-bold uppercase truncate">
                                      {serviceLabel}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!cluster && !dayGrid.coveredSlots.has(slotMin) && (
                          <div className="h-full border-l border-dashed border-neutral-300" aria-hidden />
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )
        ) : (
          <div className="overflow-x-auto border border-black relative">
            <table className="w-full border-separate border-spacing-0 text-xs table-fixed min-w-[700px]" data-testid="my-week-grid">
              <thead>
                <tr>
                  <th className="sticky left-0 z-50 bg-white border-b border-r border-black p-2 w-16 font-mono-label text-[10px] font-bold text-black shadow-[4px_0_8px_rgba(0,0,0,0.08)]">
                    HORA
                  </th>
                  {days.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <th key={i} className={`border-b border-r border-black last:border-r-0 p-3 text-left min-w-[100px] relative z-0 ${isToday ? "bg-black text-white" : "bg-white text-black"}`}>
                        <div className="font-mono-label text-[10px] font-bold opacity-80">{DAYS_ES[i]}</div>
                        <div className="font-serif-display text-2xl font-bold leading-none mt-1">{d.getDate()}</div>
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
                    <td className="sticky left-0 z-40 bg-white border-b border-r border-neutral-300 p-2 align-top font-serif-display text-lg font-bold text-black shadow-[4px_0_8px_rgba(0,0,0,0.08)]">
                      {timeLabel}
                    </td>
                    {days.map((d, i) => {
                      const ds = d.toISOString().slice(0, 10);
                      const bucket = weekGrid[ds];
                      if (!bucket) {
                        return (
                          <td key={i} className="border-b border-r border-neutral-300 last:border-r-0 p-1 align-top h-[30px] relative z-0" />
                        );
                      }
                      if (bucket.coveredSlots.has(slotMin)) return null;
                      const cluster = bucket.startsAt.get(slotMin);
                      const apptList = cluster ? cluster.appts : [];
                      const maxSpan = cluster ? cluster.span : 0;
                      const groupCount = apptList.length;
                      return (
                        <td
                          key={i}
                          rowSpan={maxSpan || 1}
                          data-testid={`my-week-cell-${ds}-${timeLabel}`}
                          className="border-b border-r border-neutral-300 last:border-r-0 p-1 align-top h-[30px] relative z-0"
                        >
                          {groupCount > 1 && (
                            <span
                              data-testid={`my-week-cell-count-${ds}-${timeLabel}`}
                              className="absolute top-0.5 right-0.5 z-10 font-mono-label text-[8px] font-bold bg-black text-white px-1 border border-black"
                            >
                              ×{groupCount}
                            </span>
                          )}
                          <div className="flex flex-col gap-1 h-full relative z-0">
                            {apptList.map((a) => {
                              const sv = findService(a.service_id);
                              const cls = a.is_floating
                                ? "bg-sky-50 border border-sky-700 border-dashed text-black"
                                : a.is_overbooked
                                ? "bg-amber-50 border border-black border-dashed text-black"
                                : a.status === "En curso"
                                ? "bg-black text-white"
                                : a.status === "Finalizada"
                                ? "bg-neutral-100 text-neutral-500 line-through font-bold"
                                : "bg-white border border-black text-black";
                              const serviceLabel = a.is_floating
                                ? a.custom_service_name
                                : (sv?.name || "—");
                              return (
                                <div
                                  key={a.id}
                                  data-testid={`my-week-appt-${a.id}`}
                                  className={`${cls} p-2 text-[10px] leading-tight flex-1 flex flex-col gap-0.5 min-h-0 overflow-hidden relative z-0`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono-label text-[8px] font-bold opacity-90">
                                      {a.start_time}—{a.end_time}
                                    </span>
                                    {a.is_floating && (
                                      <span className="font-mono-label text-[7px] font-bold bg-sky-400 text-black px-1 border border-black shrink-0">
                                        FLOT
                                      </span>
                                    )}
                                    {a.is_overbooked && !a.is_floating && (
                                      <span className="font-mono-label text-[7px] font-bold bg-amber-400 text-black px-1 border border-black shrink-0">
                                        EXTRA
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-bold leading-tight break-words">{a.client_name}</div>
                                  <div className="font-serif-display font-bold leading-tight break-words mt-0.5 uppercase">
                                    {serviceLabel}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
    </div>
  );
}
