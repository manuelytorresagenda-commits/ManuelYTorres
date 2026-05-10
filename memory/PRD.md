# Manuel & Torres · App de Gestión

## Problema original
"Mira esta app del siguiente link de github es mia: https://github.com/manuelytorresagenda-commits/ManuelYTorres. Todo está perfecto solo me gustaría que en todos los bloques para agendar y que están divididos por horas, sean mejor en medias horas."
"quedo perfecto, ya solo podrias como mejorar toda la programación en cuanto a las citas para que no haya ningún problema si se agendan varias citas extras o flotantes en una misma hora, y hacer mas robusto toda la programación de por medio para que no vaya a fallar"

## Stack
- Backend: FastAPI + MongoDB (motor async)
- Frontend: React (CRA + craco) + Tailwind
- Auth: PIN app (1234) + PIN sucursal (1111/2222/3333) + PIN maestro (0000) + login especialista por código

---

## Iteración 1 (May 10, 2026): Bloques de 30 min
- Sustituidos los bloques de 60 min por bloques de **30 min** en TODA la app (08:00–20:30, 26 filas) en `DailyAgenda.jsx`, `WeeklyAgenda.jsx`, `MyAgenda.jsx`.
- Las celdas vacías abren modal "Nueva Cita" con `HORA INICIO` prefijada al slot exacto (incluye :30).
- La duración de las citas no cambia.

## Iteración 2 (May 10, 2026): Hardening del scheduling

### Bug crítico corregido
Antes: si una cita primaria 10:00-10:45 abarcaba 2 filas (10:00 + 10:30), una cita **extra o flotante** que arrancara en 10:30 **no se renderizaba** porque la fila 10:30 estaba marcada como "cubierta" por la primaria.
Ahora: helper `buildOverlapGrid` (en `frontend/src/lib/scheduling.js`) agrupa todas las citas que se solapan (incluyendo extras/flotantes que arrancan tarde) en un solo "cluster" anclado al slot más temprano. Todas las citas del cluster se renderizan apiladas dentro de la misma celda con `rowSpan` igual al rango del cluster. Probado con hasta 5 flotantes solapadas en el mismo slot — todas visibles.

### Backend (`server.py`)
1. Validación de formato `HH:MM` (regex) y `YYYY-MM-DD` con `datetime.strptime`.
2. Validación de `client_name` no vacío.
3. Validación de duración custom: 1 ≤ duración ≤ 1440 min.
4. Validación de que `end_time` no se salga del día (24×60 min).
5. Validación de `status` enum {Confirmada, En curso, Finalizada} en POST y PATCH.
6. **Race condition** corregida: lock `asyncio.Lock` por `(specialist_id, date)` que serializa el read-then-write del conflict check + insert. Probado con 5 requests concurrentes solapadas → solo 1 acepta, 4 dan 409.
7. Conflict check ahora **excluye** citas marcadas como overbooked/floating, así una cita regular puede crearse en huecos libres aunque haya extras encima.
8. Indexes MongoDB en `(specialist_id, date)`, `(branch_id, date)`, `(date, start_time)` y unique en `id` (creados al startup, idempotentes).
9. Orden estable en GET `/api/appointments`: ordena por `(date, start_time, created_at)` para que múltiples citas en el mismo slot devuelvan en orden de creación.

### Frontend
1. **`/app/frontend/src/lib/scheduling.js` (nuevo)**: helper compartido `buildOverlapGrid` con orden estable (regular → overbooked → floating, luego created_at, luego start_time, luego id) y `SLOTS` array.
2. **`DailyAgenda.jsx`**: usa `buildOverlapGrid`. Badge `×N` en esquina del cluster cuando hay 2+ citas. data-testid: `cell-count-{spId}-{HH:MM}`.
3. **`WeeklyAgenda.jsx`**: igual. data-testid: `week-cell-count-{date}-{HH:MM}`.
4. **`MyAgenda.jsx`** (vista semana): igual. data-testid: `my-week-cell-count-{date}-{HH:MM}`.

### Validación
- **Backend pytest 23/23 PASS** (`/app/backend/tests/test_appointment_hardening.py`):
  - Validaciones de hora/fecha/duración/status/end_time
  - Conflict de regulares → 409
  - Regular se crea encima de extras existentes
  - Race condition: 5 concurrentes → 1 wins
  - Render scenario: primaria + extra ambas en GET
  - Stable ordering por created_at
- **Frontend manual screenshots**:
  - 3 citas solapadas (primaria+extra+flotante) → cluster con badge ×3, todas visibles ✓
  - 5 citas flotantes en el mismo slot 14:00 → cluster con badge ×5, todas visibles ✓
  - Vista semanal idem ✓

## Archivos modificados
- /app/backend/server.py
- /app/frontend/src/lib/scheduling.js (nuevo)
- /app/frontend/src/pages/DailyAgenda.jsx
- /app/frontend/src/pages/WeeklyAgenda.jsx
- /app/frontend/src/pages/MyAgenda.jsx
- /app/backend/tests/test_appointment_hardening.py (nuevo)

## Backlog / próximos pasos
- (opcional) Layout en columnas dentro del cluster cuando hay 3+ citas (estilo Google Calendar)
- (opcional) Botón "+ Extra" sobre el cluster para añadir directamente una cita encima
- (opcional) Vista de día con zoom (15 min slots) para gestores con alta densidad
