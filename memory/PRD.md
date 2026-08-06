# Manuel & Torres · App de Gestión

## Stack
- Backend: FastAPI + MongoDB
- Frontend: React + Tailwind
- Auth: PIN app (1234) + PIN sucursal (1111/2222/3333) + PIN maestro (0000)

## Iteraciones anteriores (resumen)
- 30-min slots · hardening del scheduling con clusters · MyAgenda altura proporcional · directorio de clientes con autocompletado (IG/TT/cumple) · página "Cumpleañeros del Mes" · WhatsApp deep-link al confirmar cita · PIN Centro=1111 forzado en seed · sidebar sticky.

## Iteración 8 (Jul 29, 2026): Reagendar cita

### Backend
- Modelo `AppointmentReschedule { specialist_id?: str, date: str, start_time: str }`.
- Endpoint `POST /api/appointments/{id}/reschedule`:
  - Valida formato de hora/fecha.
  - Preserva duración original (o `custom_duration_minutes` si es flotante).
  - Verifica que la nueva ventana esté dentro del turno del especialista nuevo.
  - Conflict check con lock per-(specialist, date), ignora la propia cita y las citas overbooked/floating.
  - Si la cita que se mueve es overbooked/floating, se salta el conflict check (mismo criterio de create_appointment).
  - Actualiza specialist_id, branch_id (por si cambia de sucursal), date, start_time, end_time.
- Errores claros: 400 fuera de turno / 409 conflicto / 404 cita no encontrada.

### Frontend
- Nuevo `components/RescheduleModal.jsx`:
  - Se abre desde botón `REAGENDAR` en `AppointmentDetailModal`.
  - Select de especialista (todos los de la sucursal activa).
  - Date picker.
  - Grid de 27 slots (08:00-20:30) con estados: libre (blanco) · seleccionado (negro) · ocupado/fuera-de-turno (gris tachado).
  - Duración fija preservada; badge de aviso especial si la cita es EXTRA/FLOTANTE.
  - Preview del cambio: "DE: fecha · rango → fecha · rango" en el header.
- `AppointmentDetailModal.jsx`: botón `📅 REAGENDAR` visible salvo cuando la cita está "Finalizada".
- Todas las citas (incluidas flotantes) se pueden reagendar.

### Validación
- Backend curl (4 casos):
  - Mover a slot libre mismo especialista → 200 ✓
  - Mover a otro especialista con turno incompatible → 400 ✓
  - Choque con cita normal existente → 409 ✓
  - Fuera de turno (21:00) → 400 ✓
- Frontend manual: click en cita → REAGENDAR → grid muestra correctamente slots disponibles vs bloqueados → confirmar → toast "Cita reagendada" y la cita aparece en su nuevo horario en la agenda.

## Archivos clave modificados / nuevos
- /app/backend/server.py (endpoint reschedule + modelo)
- /app/frontend/src/lib/api.js (rescheduleAppointment)
- /app/frontend/src/components/RescheduleModal.jsx (nuevo)
- /app/frontend/src/components/AppointmentDetailModal.jsx (botón + integración)

## Backlog
- Confirmación por WhatsApp también al REAGENDAR (mismo mensaje pero con "Tu cita fue REAGENDADA a…").
- Historial de cambios por cita.
- Pantalla "Clientes" para gestión completa.
