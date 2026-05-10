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

  const grouped = useMemo(() => {
    const map = {};
    SLOTS.forEach((s) => (map[s] = []));
    appointments.forEach((a) => {
      const startMin = timeToMin(a.start_time);
      const slot = Math.floor(startMin / 30) * 30;
      if (map[slot]) map[slot].push(a);
    });
    return map;
  }, [appointments]);

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
    <div className="min-h-screen bg-white" data-testid="my-agenda-page">
      {/* Top bar */}
      <header className="border-b border-black px-6 lg:px-12 py-6 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          {specialist.avatar_url ? (
            <img src={specialist.avatar_url} alt="" className="w-14 h-14 object-cover grayscale border border-black" />
          ) : (
            <div className="w-14 h-14 bg-neutral-200 flex items-center justify-center font-serif-display text-2xl">
              {specialist.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
          )}
          <div>
            <div className="font-mono-label text-[10px] text-neutral-500">ESPECIALISTA</div>
            <div className="font-serif-display text-3xl leading-none mt-1" data-testid="my-name">{specialist.name}</div>
            <div className="text-xs text-neutral-600 mt-1">{specialist.specialty} · {specialist.start_time}—{specialist.end_time}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="my-logout-btn"
          className="btn-invert border border-black px-4 py-3 font-mono-label text-[10px] hover:bg-black hover:text-white flex items-center gap-2"
        >
          <LogOut className="w-3 h-3" strokeWidth={1.5} /> Salir
        </button>
      </header>

      {/* View toggle */}
      <div className="border-b border-black flex">
        <button
          data-testid="my-view-day"
          onClick={() => setView("day")}
          className={`btn-invert px-6 py-4 font-mono-label text-[10px] border-r border-neutral-200 flex items-center gap-2 ${
            view === "day" ? "bg-black text-white" : "hover:bg-neutral-100"
          }`}
        >
          <CalendarDays className="w-3 h-3" strokeWidth={1.5} /> Hoy
        </button>
        <button
          data-testid="my-view-week"
          onClick={() => setView("week")}
          className={`btn-invert px-6 py-4 font-mono-label text-[10px] border-r border-neutral-200 flex items-center gap-2 ${
            view === "week" ? "bg-black text-white" : "hover:bg-neutral-100"
          }`}
        >
          <CalendarRange className="w-3 h-3" strokeWidth={1.5} /> Semana
        </button>
        <div className="flex-1" />
        {view === "week" && (
          <div className="flex items-center gap-1 px-3">
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
              data-testid="my-week-prev"
              className="btn-invert border border-black h-9 w-9 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-mono-label text-[10px] px-3" data-testid="my-week-range">{fmtRange()}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
              data-testid="my-week-next"
              className="btn-invert border border-black h-9 w-9 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 lg:p-12">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs text-neutral-500">Cargando...</div>
        ) : view === "day" ? (
          appointments.length === 0 ? (
            <div className="border border-black p-12 text-center" data-testid="my-empty-day">
              <div className="font-serif-display text-3xl mb-2">Sin citas asignadas hoy</div>
              <p className="text-sm text-neutral-600">Disfrute su día.</p>
            </div>
          ) : (
            <div data-testid="my-day-timeline">
              <div className="font-mono-label text-[10px] text-neutral-500 mb-4">
                {appointments.length} CITA{appointments.length !== 1 ? "S" : ""} HOY
              </div>
              {SLOTS.map((slotMin) => {
                const items = grouped[slotMin] || [];
                const hh = Math.floor(slotMin / 60);
                const mm = slotMin % 60;
                return (
                  <div key={slotMin} className="grid grid-cols-[80px_1fr] gap-6 border-t border-neutral-200 py-4 first:border-t-0">
                    <div className="font-serif-display text-3xl text-neutral-400 leading-none pt-1">
                      {String(hh).padStart(2, "0")}<span className="text-base align-top">:{String(mm).padStart(2, "0")}</span>
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="h-12 border-l border-dashed border-neutral-300" />
                      ) : (
                        items
                          .sort((a, b) => a.start_time.localeCompare(b.start_time))
                          .map((a) => {
                            const sv = findService(a.service_id);
                            const serviceLabel = a.is_floating
                              ? a.custom_service_name
                              : (sv?.name || "—");
                            return (
                              <div key={a.id} data-testid={`my-appt-${a.id}`}
                                   className={`border ${STATUS_STYLES[a.status]} p-4 lg:p-5`}>
                                <div className="flex items-center gap-3 mb-1">
                                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                                  <span className="font-mono-label text-[10px]">
                                    {a.start_time} — {a.end_time} · {a.status}
                                  </span>
                                  {a.is_floating && (
                                    <span className="font-mono-label text-[8px] bg-sky-400 text-black px-1.5 py-0.5 border border-black">
                                      FLOTANTE
                                    </span>
                                  )}
                                  {a.is_overbooked && !a.is_floating && (
                                    <span className="font-mono-label text-[8px] bg-amber-400 text-black px-1.5 py-0.5 border border-black">
                                      EXTRA
                                    </span>
                                  )}
                                </div>
                                <div className="font-serif-display text-2xl lg:text-3xl leading-tight">
                                  {a.client_name}
                                </div>
                                <div className="text-sm mt-1 opacity-80">{serviceLabel}</div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="overflow-x-auto border border-black">
            <table className="w-full border-collapse text-xs" data-testid="my-week-grid">
              <thead>
                <tr>
                  <th className="border-b border-r border-neutral-300 p-2 w-16 font-mono-label text-[9px] text-neutral-500">HORA</th>
                  {days.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <th key={i} className={`border-b border-r border-neutral-300 last:border-r-0 p-3 text-left ${isToday ? "bg-black text-white" : ""}`}>
                        <div className="font-mono-label text-[9px] opacity-70">{DAYS_ES[i]}</div>
                        <div className="font-serif-display text-2xl leading-none mt-1">{d.getDate()}</div>
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
                    <td className="border-b border-r border-neutral-200 p-2 align-top font-mono-label text-[9px] text-neutral-500">
                      {timeLabel}
                    </td>
                    {days.map((d, i) => {
                      const ds = d.toISOString().slice(0, 10);
                      const bucket = weekGrid[ds];
                      if (!bucket) {
                        return (
                          <td key={i} className="border-b border-r border-neutral-200 last:border-r-0 p-1 align-top h-[30px]" />
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
                          className="border-b border-r border-neutral-200 last:border-r-0 p-1 align-top h-[30px] relative"
                        >
                          {groupCount > 1 && (
                            <span
                              data-testid={`my-week-cell-count-${ds}-${timeLabel}`}
                              className="absolute top-0.5 right-0.5 z-10 font-mono-label text-[7px] bg-black text-white px-1 border border-black"
                            >
                              ×{groupCount}
                            </span>
                          )}
                          <div className="flex flex-col gap-1 h-full">
                            {apptList.map((a) => {
                              const sv = findService(a.service_id);
                              const cls = a.is_floating
                                ? "bg-sky-50 border border-sky-700 border-dashed text-black"
                                : a.is_overbooked
                                ? "bg-amber-50 border border-black border-dashed text-black"
                                : a.status === "En curso"
                                ? "bg-black text-white"
                                : a.status === "Finalizada"
                                ? "bg-neutral-100 text-neutral-400 line-through"
                                : "bg-white border border-black";
                              const serviceLabel = a.is_floating
                                ? a.custom_service_name
                                : (sv?.name || "—");
                              return (
                                <div
                                  key={a.id}
                                  data-testid={`my-week-appt-${a.id}`}
                                  className={`${cls} p-2 text-[10px] leading-tight flex-1 flex flex-col gap-0.5 min-h-0`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono-label text-[8px] opacity-70">
                                      {a.start_time}—{a.end_time}
                                    </span>
                                    {a.is_floating && (
                                      <span className="font-mono-label text-[7px] bg-sky-400 text-black px-1 border border-black">
                                        FLOT
                                      </span>
                                    )}
                                    {a.is_overbooked && !a.is_floating && (
                                      <span className="font-mono-label text-[7px] bg-amber-400 text-black px-1 border border-black">
                                        EXTRA
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-medium truncate">{a.client_name}</div>
                                  <div className="opacity-80 truncate font-serif-display">
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
