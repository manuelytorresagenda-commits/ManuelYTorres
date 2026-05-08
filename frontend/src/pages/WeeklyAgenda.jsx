import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import SpecialistFilter from "../components/SpecialistFilter";
import { fetchAppointments, fetchSpecialists, fetchServices } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // make Monday=0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);

export default function WeeklyAgenda() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSpecialist, setFilterSpecialist] = useState("all");
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
      const [a, sp, sv] = await Promise.all([
        fetchAppointments({ week_start: ws, branch_id: branch.id }),
        fetchSpecialists({ branch_id: branch.id }),
        fetchServices({ branch_id: branch.id }),
      ]);
      setAppointments(a);
      setSpecialists(sp);
      setServices(sv);
    } catch { toast.error("Error cargando datos"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart, branch]);

  const goPrev = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
  };
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const findSp = (id) => specialists.find((s) => s.id === id);
  const findSv = (id) => services.find((s) => s.id === id);

  // Build per-day grid: { [dateStr]: { startsAt: Map(hour->[appts]), coveredHours: Set } }
  const grid = useMemo(() => {
    const result = {};
    days.forEach((d) => {
      const ds = d.toISOString().slice(0, 10);
      result[ds] = { startsAt: new Map(), coveredHours: new Set() };
    });
    appointments.forEach((a) => {
      if (filterSpecialist !== "all" && a.specialist_id !== filterSpecialist) return;
      if (!result[a.date]) return;
      const startMin = timeToMin(a.start_time);
      const endMin = timeToMin(a.end_time);
      const startHour = Math.floor(startMin / 60);
      const endHour = Math.ceil(endMin / 60);
      const span = Math.max(1, endHour - startHour);
      const list = result[a.date].startsAt.get(startHour) || [];
      list.push({ appt: a, span });
      result[a.date].startsAt.set(startHour, list);
    });
    Object.values(result).forEach((bucket) => {
      bucket.startsAt.forEach((list, startHour) => {
        const maxSpan = list.reduce((m, x) => Math.max(m, x.span), 1);
        for (let h = startHour + 1; h < startHour + maxSpan; h++) {
          bucket.coveredHours.add(h);
        }
      });
    });
    return result;
  }, [appointments, days, filterSpecialist]);

  const fmtRange = () => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${f(weekStart)} — ${f(end)}`;
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
            <button onClick={goPrev} data-testid="week-prev"
              className="btn-invert border border-black h-12 w-12 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button onClick={goToday} data-testid="week-today"
              className="btn-invert border border-black h-12 px-4 font-mono-label text-[10px] hover:bg-black hover:text-white">
              HOY
            </button>
            <button onClick={goNext} data-testid="week-next"
              className="btn-invert border border-black h-12 w-12 flex items-center justify-center hover:bg-black hover:text-white">
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      <div className="px-6 lg:px-12 py-4 border-b border-neutral-200">
        <div className="font-mono-label text-[10px] text-neutral-500">SEMANA EN CURSO</div>
        <div className="font-serif-display text-3xl mt-1" data-testid="week-range">{fmtRange()}</div>
      </div>

      <SpecialistFilter
        specialists={specialists}
        value={filterSpecialist}
        onChange={setFilterSpecialist}
      />

      <div className="p-6 lg:p-12">
        {loading ? (
          <div className="text-center py-20 font-mono-label text-xs text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto border border-black">
            <table className="w-full border-collapse text-xs" data-testid="weekly-grid">
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
                {HOURS.map((h) => (
                  <tr key={h}>
                    <td className="border-b border-r border-neutral-200 p-2 align-top font-mono-label text-[9px] text-neutral-500">
                      {String(h).padStart(2, "0")}:00
                    </td>
                    {days.map((d, i) => {
                      const ds = d.toISOString().slice(0, 10);
                      const bucket = grid[ds];
                      if (!bucket) {
                        return (
                          <td key={i} className="border-b border-r border-neutral-200 last:border-r-0 p-1 align-top h-[60px]" />
                        );
                      }
                      if (bucket.coveredHours.has(h)) return null;
                      const list = bucket.startsAt.get(h) || [];
                      const maxSpan = list.reduce((m, x) => Math.max(m, x.span), 0);
                      return (
                        <td
                          key={i}
                          rowSpan={maxSpan || 1}
                          className="border-b border-r border-neutral-200 last:border-r-0 p-1 align-top h-[60px]"
                          data-testid={`week-cell-${ds}-${h}`}
                        >
                          <div className="flex flex-col gap-1 h-full">
                            {list.map(({ appt: a }) => {
                              const sv = findSv(a.service_id);
                              const sp = findSp(a.specialist_id);
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
                                  data-testid={`week-appt-${a.id}`}
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
                                  <div className="opacity-60 truncate font-mono-label text-[8px]">
                                    {sp?.name?.split(" ")[0]}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
    </div>
  );
}
