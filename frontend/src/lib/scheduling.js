// Shared scheduling helpers for the agenda grids.
// Slot grid: half-hour blocks from 08:00 to 20:30 (26 slots).

export const SLOT_MIN = 30;
export const FIRST_SLOT_MIN = 8 * 60;   // 08:00
export const LAST_SLOT_MIN = 20 * 60 + 30; // 20:30 (inclusive)
export const SLOTS = Array.from(
  { length: (LAST_SLOT_MIN - FIRST_SLOT_MIN) / SLOT_MIN + 1 },
  (_, i) => FIRST_SLOT_MIN + i * SLOT_MIN
);

export function timeToMin(t) {
  if (typeof t !== "string") return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minToTime(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.floor(min)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Snap a minute value down to the slot grid (multiples of 30).
function snapDown(min) {
  return Math.floor(min / SLOT_MIN) * SLOT_MIN;
}

function snapUp(min) {
  return Math.ceil(min / SLOT_MIN) * SLOT_MIN;
}

// Stable order: regular > overbooked > floating, then created_at asc, then start_time asc, then id.
function orderKey(a) {
  const kind = a.is_floating ? 2 : a.is_overbooked ? 1 : 0;
  const created = a.created_at ? new Date(a.created_at).getTime() : 0;
  return [kind, created, timeToMin(a.start_time || "00:00"), a.id || ""];
}

function compareAppts(a, b) {
  const ka = orderKey(a);
  const kb = orderKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/**
 * Group overlapping appointments into clusters and return a per-anchor map ready
 * for rendering with rowSpan.
 *
 * Returns:
 *   {
 *     startsAt: Map<slotMin, { appts: [...sorted], span: int, startSlot, endSlot }>,
 *     coveredSlots: Set<slotMin>
 *   }
 *
 * Notes:
 *  - Appointments that overlap (or whose slot ranges touch within the same group)
 *    are merged into a single cluster anchored at the earliest startSlot. The
 *    cluster's rowSpan covers from the cluster's earliest startSlot to its
 *    latest endSlot. This guarantees that a late-starting extra/floating
 *    appointment inside a primary appointment is NEVER hidden — it appears
 *    inside the same merged cell next to the primary.
 *  - The caller is expected to render `cluster.appts` stacked (or laid out in
 *    columns) inside one cell using rowSpan = cluster.span.
 */
export function buildOverlapGrid(appointments) {
  const startsAt = new Map();
  const coveredSlots = new Set();

  if (!appointments || appointments.length === 0) {
    return { startsAt, coveredSlots };
  }

  // Sort by start time first to make grouping deterministic.
  const sorted = [...appointments].sort((a, b) => {
    const sa = timeToMin(a.start_time);
    const sb = timeToMin(b.start_time);
    if (sa !== sb) return sa - sb;
    return compareAppts(a, b);
  });

  let cluster = null; // { startSlot, endSlot, appts:[] }
  const clusters = [];

  for (const a of sorted) {
    const startMin = timeToMin(a.start_time);
    const endMin = timeToMin(a.end_time || a.start_time);
    const startSlot = snapDown(startMin);
    const endSlot = Math.max(startSlot + SLOT_MIN, snapUp(endMin));

    if (cluster && startSlot < cluster.endSlot) {
      // Overlaps current cluster -> merge
      cluster.appts.push(a);
      if (endSlot > cluster.endSlot) cluster.endSlot = endSlot;
    } else {
      if (cluster) clusters.push(cluster);
      cluster = { startSlot, endSlot, appts: [a] };
    }
  }
  if (cluster) clusters.push(cluster);

  for (const c of clusters) {
    c.appts.sort(compareAppts);
    const span = Math.max(1, (c.endSlot - c.startSlot) / SLOT_MIN);
    startsAt.set(c.startSlot, {
      appts: c.appts,
      span,
      startSlot: c.startSlot,
      endSlot: c.endSlot,
    });
    for (let s = c.startSlot + SLOT_MIN; s < c.endSlot; s += SLOT_MIN) {
      coveredSlots.add(s);
    }
  }

  return { startsAt, coveredSlots };
}

// Convenience: status of an appointment in a cluster (used for visual styling).
export function clusterHasMultiple(cluster) {
  return cluster && cluster.appts && cluster.appts.length > 1;
}
