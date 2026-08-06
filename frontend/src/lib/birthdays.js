// Extract { day, month, year? } from any accepted birthday format:
//   "YYYY-MM-DD"  → {y, m, d}
//   "MM-DD"       → {m, d}
//   "DD/MM"       → {m, d}
//   "DD/MM/YYYY"  → {y, m, d}
// Returns null when the value is empty or malformed.
export function parseBirthday(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  // YYYY-MM-DD
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  // MM-DD
  m = v.match(/^(\d{2})-(\d{2})$/);
  if (m) return { y: null, m: +m[1], d: +m[2] };
  // DD/MM/YYYY
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  // DD/MM
  m = v.match(/^(\d{2})\/(\d{2})$/);
  if (m) return { y: null, m: +m[2], d: +m[1] };
  return null;
}

export function ageOnDate(birthday, refDate) {
  const p = parseBirthday(birthday);
  if (!p || !p.y) return null;
  const d = refDate || new Date();
  let age = d.getFullYear() - p.y;
  const beforeBday =
    d.getMonth() + 1 < p.m || (d.getMonth() + 1 === p.m && d.getDate() < p.d);
  if (beforeBday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const DAYS_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
