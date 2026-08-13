// Build the wa.me deep-link used to notify a client that her appointment has
// been booked. Only used for NORMAL appointments (never for floating ones).
//
// Returns the full URL ready to open in a new tab, or null when there is not
// enough data (e.g. missing phone).

const DAYS_LONG_ES = [
  "domingo", "lunes", "martes", "mi\u00e9rcoles", "jueves", "viernes", "s\u00e1bado",
];
const MONTHS_LONG_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatLongDate(iso) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DAYS_LONG_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function digitsOnly(phone) {
  return (phone || "").replace(/\D/g, "");
}

export function buildBookingWhatsappUrl({
  clientName,
  clientPhone,
  date,
  startTime,
  endTime,
  serviceName,
  specialistName,
  branchName,
  receptionistName,
}) {
  const digits = digitsOnly(clientPhone);
  if (!digits) return null;
  const firstName = (clientName || "cliente").split(/\s+/)[0];
  const branchLine = branchName || "Manuel & Torres";

  const lines = [
    `\u00a1Hola ${firstName}!`,
    "",
    `Tu cita en *${branchLine}* qued\u00f3 *agendada* \u2713`,
    "",
    `Fecha: ${formatLongDate(date)}`,
    `Hora: ${startTime}${endTime ? ` - ${endTime}` : ""}`,
    serviceName ? `Servicio: ${serviceName}` : null,
    specialistName ? `Te atender\u00e1: ${specialistName}` : null,
    receptionistName ? `Le agend\u00f3: ${receptionistName}` : null,
    "",
    "Si necesitas reagendar, cont\u00e1ctanos con tiempo.",
    "\u00a1Te esperamos!",
  ].filter((x) => x !== null);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${digits}?text=${text}`;
}

export function openBookingWhatsapp(args) {
  const url = buildBookingWhatsappUrl(args);
  if (!url) return false;
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    return !!w;
  } catch {
    return false;
  }
}

export function buildRescheduleWhatsappUrl({
  clientName,
  clientPhone,
  date,
  startTime,
  endTime,
  serviceName,
  specialistName,
  branchName,
  receptionistName,
  previousDate,
  previousStartTime,
  previousEndTime,
}) {
  const digits = digitsOnly(clientPhone);
  if (!digits) return null;
  const firstName = (clientName || "cliente").split(/\s+/)[0];
  const branchLine = branchName || "Manuel & Torres";

  const lines = [
    `\u00a1Hola ${firstName}!`,
    "",
    `Tu cita en *${branchLine}* fue *reagendada con \u00e9xito* \u2713`,
    "",
    "*NUEVOS DETALLES:*",
    `Fecha: ${formatLongDate(date)}`,
    `Hora: ${startTime}${endTime ? ` - ${endTime}` : ""}`,
    serviceName ? `Servicio: ${serviceName}` : null,
    specialistName ? `Te atender\u00e1: ${specialistName}` : null,
    receptionistName ? `Le agend\u00f3: ${receptionistName}` : null,
  ];
  if (previousDate && previousStartTime) {
    lines.push("");
    lines.push(
      `_(Anteriormente: ${formatLongDate(previousDate)} \u00b7 ${previousStartTime}${previousEndTime ? ` - ${previousEndTime}` : ""})_`
    );
  }
  lines.push("");
  lines.push("Si necesitas otro cambio, cont\u00e1ctanos con tiempo.");
  lines.push("\u00a1Te esperamos!");

  const text = encodeURIComponent(lines.filter((x) => x !== null).join("\n"));
  return `https://wa.me/${digits}?text=${text}`;
}

export function openRescheduleWhatsapp(args) {
  const url = buildRescheduleWhatsappUrl(args);
  if (!url) return false;
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    return !!w;
  } catch {
    return false;
  }
}
