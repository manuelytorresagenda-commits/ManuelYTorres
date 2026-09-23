// Build the wa.me deep-link used to notify a client that her appointment has
// been booked. Only used for NORMAL appointments (never for floating ones).
//
// Returns the full URL ready to open in a new tab, or null when there is not
// enough data (e.g. missing phone).

const DAYS_LONG_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
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
    `¡Hola ${firstName}!`,
    "",
    `Tu cita en *${branchLine}* quedó *agendada* ✓`,
    "",
    `Fecha: ${formatLongDate(date)}`,
    `Hora: ${startTime}`,
    serviceName ? `Servicio: ${serviceName}` : null,
    specialistName ? `Te atenderá: ${specialistName}` : null,
    receptionistName ? `Le agendó: ${receptionistName}` : null,
    "",
    "Si necesitas reagendar, contáctanos con tiempo.",
    "¡Te esperamos!",
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
    `¡Hola ${firstName}!`,
    "",
    `Tu cita en *${branchLine}* fue *reagendada con éxito* ✓`,
    "",
    "*NUEVOS DETALLES:*",
    `Fecha: ${formatLongDate(date)}`,
    `Hora: ${startTime}`,
    serviceName ? `Servicio: ${serviceName}` : null,
    specialistName ? `Te atenderá: ${specialistName}` : null,
    receptionistName ? `Le agendó: ${receptionistName}` : null,
  ];
  if (previousDate && previousStartTime) {
    lines.push("");
    lines.push(
      `_(Anteriormente: ${formatLongDate(previousDate)} · ${previousStartTime})_`
    );
  }
  lines.push("");
  lines.push("Si necesitas otro cambio, contáctanos con tiempo.");
  lines.push("¡Te esperamos!");

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
