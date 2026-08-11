import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { fetchClients } from "../lib/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import {
  Cake,
  ChevronLeft,
  ChevronRight,
  Phone,
  Instagram,
  Music2,
  X,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { parseBirthday, ageOnDate, MONTHS_ES, DAYS_SHORT_ES } from "../lib/birthdays";

function startOfMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function BirthdaysOfMonth() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchClients()
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Error cargando clientes"))
      .finally(() => setLoading(false));
  }, []);

  const monthBirthdays = useMemo(() => {
    const out = [];
    for (const c of clients) {
      const p = parseBirthday(c.birthday);
      if (!p) continue;
      if (p.m !== month + 1) continue;
      out.push({ client: c, day: p.d, parsed: p });
    }
    out.sort((a, b) => a.day - b.day || a.client.name.localeCompare(b.client.name));
    return out;
  }, [clients, month]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const b of monthBirthdays) {
      const list = map.get(b.day) || [];
      list.push(b);
      map.set(b.day, list);
    }
    return map;
  }, [monthBirthdays]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridStart = startOfMonthGrid(year, month);
  const weeks = [];
  {
    const cur = new Date(gridStart);
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(row);
      if (row[6].getMonth() !== month && row[6] > new Date(year, month, daysInMonth)) {
        break;
      }
    }
  }

  const goPrev = () => {
    let m = month - 1;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    setMonth(m); setYear(y);
  };
  const goNext = () => {
    let m = month + 1;
    let y = year;
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  };
  const goToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div data-testid="birthdays-page">
      <PageHeader
        eyebrow="DIRECTORIO"
        title="Cumpleañeros"
        italic="del mes"
        description="Clientes registradas con cumpleaños en el mes seleccionado. Toque una tarjeta para ver sus datos."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              data-testid="month-prev"
              className="btn-invert border border-black h-12 w-12 flex items-center justify-center hover:bg-black hover:text-white"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={goToday}
              data-testid="month-today"
              className="btn-invert border border-black h-12 px-4 font-mono-label text-[10px] font-bold hover:bg-black hover:text-white"
            >
              HOY
            </button>
            <button
              onClick={goNext}
              data-testid="month-next"
              className="btn-invert border border-black h-12 w-12 flex items-center justify-center hover:bg-black hover:text-white"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        }
      />

      <div className="px-6 lg:px-12 py-5 border-b border-neutral-300 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-mono-label text-[10px] font-bold text-black">MES EN VISTA</div>
          <div
            className="font-serif-display text-3xl lg:text-4xl mt-1 leading-none text-black font-bold"
            data-testid="month-label"
          >
            {MONTHS_ES[month]} <em className="italic text-neutral-700 font-serif-display">{year}</em>
          </div>
        </div>
        <div
          className="border-2 border-black px-5 py-3 flex items-center gap-3 bg-white"
          data-testid="month-count"
        >
          <PartyPopper className="w-4 h-4 text-black" strokeWidth={2} />
          <div>
            <div className="font-mono-label text-[9px] font-bold text-black">CUMPLEAÑOS</div>
            <div className="font-serif-display text-2xl font-bold leading-none text-black">
              {String(monthBirthdays.length).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 font-mono-label text-xs font-bold text-black">Cargando…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0">
          {/* Calendar grid */}
          <div className="p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-neutral-300">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_SHORT_ES.map((d) => (
                <div
                  key={d}
                  className="font-mono-label text-[10px] font-bold text-black px-2 py-1 text-center"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="border border-black" data-testid="birthday-calendar">
              {weeks.map((row, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-neutral-300 last:border-b-0">
                  {row.map((d, di) => {
                    const inMonth = d.getMonth() === month;
                    const dayKey = d.getDate();
                    const list = inMonth ? byDay.get(dayKey) || [] : [];
                    const isToday =
                      d.getFullYear() === today.getFullYear() &&
                      d.getMonth() === today.getMonth() &&
                      d.getDate() === today.getDate();
                    return (
                      <div
                        key={di}
                        data-testid={inMonth ? `cal-day-${dayKey}` : undefined}
                        className={`border-r border-neutral-300 last:border-r-0 min-h-[88px] p-2 align-top flex flex-col ${
                          inMonth ? "bg-white" : "bg-neutral-100 text-neutral-400 font-semibold"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className={`font-serif-display text-xl leading-none font-bold ${
                              isToday ? "bg-black text-white px-2 py-1" : inMonth ? "text-black" : "text-neutral-400"
                            }`}
                          >
                            {d.getDate()}
                          </span>
                          {list.length > 0 && (
                            <Cake className="w-3.5 h-3.5 text-black" strokeWidth={2} aria-hidden />
                          )}
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          {list.slice(0, 3).map((b) => (
                            <button
                              key={b.client.id || b.client.name}
                              type="button"
                              onClick={() => setSelected(b.client)}
                              data-testid={`cal-bday-${dayKey}-${b.client.id || b.client.name}`}
                              className="btn-invert text-left bg-amber-100 border-2 border-black px-1.5 py-1 font-mono-label text-[9px] font-bold text-black hover:bg-black hover:text-white truncate"
                              title={b.client.name}
                            >
                              {b.client.name}
                            </button>
                          ))}
                          {list.length > 3 && (
                            <span className="font-mono-label text-[8px] font-bold text-black">
                              +{list.length - 3} más
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {isCurrentMonth && (
              <div
                className="font-mono-label text-[10px] font-bold text-black mt-3"
                data-testid="calendar-today-note"
              >
                ◐ HOY es {today.getDate()} de {MONTHS_ES[month].toLowerCase()}
              </div>
            )}
          </div>

          {/* List of birthdays this month */}
          <div className="p-6 lg:p-10">
            <div className="font-mono-label text-[10px] font-bold text-black mb-4">
              LISTA · {MONTHS_ES[month].toUpperCase()}
            </div>
            {monthBirthdays.length === 0 ? (
              <div
                className="border-2 border-dashed border-neutral-300 p-8 text-center"
                data-testid="birthdays-empty"
              >
                <Cake className="w-6 h-6 mx-auto mb-3 text-black" strokeWidth={2} />
                <div className="font-serif-display text-2xl mb-1 text-black font-bold">Sin cumpleaños este mes</div>
                <p className="text-xs font-medium text-neutral-700">
                  Las fechas se cargan cuando registras un cumpleaños al crear una cita.
                </p>
              </div>
            ) : (
              <ul className="space-y-2" data-testid="birthdays-list">
                {monthBirthdays.map(({ client, day, parsed }) => {
                  const age = ageOnDate(client.birthday, new Date(year, month, day));
                  const willTurn =
                    parsed.y
                      ? `Cumplirá ${age != null ? age + 1 : "?"}`
                      : "Año no registrado";
                  return (
                    <li key={client.id || client.name}>
                      <button
                        type="button"
                        data-testid={`birthday-row-${client.id || client.name}`}
                        onClick={() => setSelected(client)}
                        className="btn-invert w-full text-left border-2 border-black px-4 py-3 hover:bg-black hover:text-white flex items-center gap-4 group"
                      >
                        <div className="w-12 text-center shrink-0">
                          <div className="font-mono-label text-[9px] font-bold text-neutral-800 group-hover:text-neutral-200">
                            {MONTHS_ES[month].slice(0, 3).toUpperCase()}
                          </div>
                          <div className="font-serif-display text-3xl font-bold leading-none text-black group-hover:text-white">
                            {String(day).padStart(2, "0")}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-serif-display text-xl font-bold leading-tight truncate text-black group-hover:text-white">
                            {client.name}
                          </div>
                          <div className="font-mono-label text-[9px] font-bold text-neutral-800 group-hover:text-neutral-200 mt-1 truncate">
                            {willTurn}
                            {client.phone ? ` · ${client.phone}` : ""}
                          </div>
                        </div>
                        <Cake className="w-4 h-4 shrink-0 text-black group-hover:text-white" strokeWidth={2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <BirthdayClientModal
        client={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function BirthdayClientModal({ client, onClose }) {
  const open = !!client;
  const p = client ? parseBirthday(client.birthday) : null;
  const formattedBday = p
    ? `${String(p.d).padStart(2, "0")} ${MONTHS_ES[p.m - 1]}${p.y ? `, ${p.y}` : ""}`
    : "—";
  const age = client ? ageOnDate(client.birthday) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose && onClose()}>
      <DialogContent
        data-testid="birthday-client-modal"
        className="max-w-md bg-white border-2 border-black rounded-none p-0 gap-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Datos de la cliente</DialogTitle>
        <DialogDescription className="sr-only">
          Información de contacto y cumpleaños.
        </DialogDescription>
        {client && (
          <>
            <div className="flex items-start justify-between p-6 border-b-2 border-black bg-amber-50">
              <div>
                <div className="flex items-center gap-2">
                  <Cake className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                  <span className="font-mono-label text-[10px] font-bold text-black">CUMPLEAÑOS</span>
                </div>
                <div
                  className="font-serif-display text-3xl mt-1 leading-none font-bold text-black"
                  data-testid="bday-modal-name"
                >
                  {client.name}
                </div>
                <div className="font-mono-label text-[10px] font-bold text-neutral-800 mt-2">
                  {formattedBday}
                  {age != null ? ` · cumple ${age + 1}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-testid="bday-modal-close"
                className="btn-invert border-2 border-black p-2 hover:bg-black hover:text-white"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
            <div className="p-6 space-y-3" data-testid="bday-modal-info">
              <DetailRow
                icon={<Phone className="w-3.5 h-3.5 text-black" strokeWidth={2} />}
                label="TELÉFONO"
                value={client.phone}
                href={client.phone ? `tel:${client.phone}` : null}
              />
              <DetailRow
                icon={<Instagram className="w-3.5 h-3.5 text-black" strokeWidth={2} />}
                label="INSTAGRAM"
                value={client.instagram ? `@${client.instagram}` : ""}
                href={client.instagram ? `https://instagram.com/${client.instagram}` : null}
                external
              />
              <DetailRow
                icon={<Music2 className="w-3.5 h-3.5 text-black" strokeWidth={2} />}
                label="TIKTOK"
                value={client.tiktok ? `@${client.tiktok}` : ""}
                href={client.tiktok ? `https://tiktok.com/@${client.tiktok}` : null}
                external
              />
              {client.phone && (
                <a
                  href={`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `¡Feliz cumpleaños, ${client.name}! Te tenemos un detalle en Manuel & Torres 🎁`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="bday-modal-wa"
                  className="btn-invert mt-4 block border-2 border-black bg-black text-white px-4 py-3 font-mono-label text-[10px] font-bold hover:bg-white hover:text-black text-center"
                >
                  ENVIAR FELICITACIÓN POR WHATSAPP
                </a>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value, href, external }) {
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-neutral-300 px-4 py-3">
      <div className="flex items-center gap-2 font-mono-label text-[9px] font-bold text-black">
        {icon}
        <span>{label}</span>
      </div>
      {value ? (
        href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="font-mono-label text-[11px] font-bold underline truncate max-w-[60%] text-black"
          >
            {value}
          </a>
        ) : (
          <span className="font-mono-label text-[11px] font-bold truncate max-w-[60%] text-black">{value}</span>
        )
      ) : (
        <span className="text-xs font-bold text-neutral-400">—</span>
      )}
    </div>
  );
}
