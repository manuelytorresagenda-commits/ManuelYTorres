# Manuel & Torres — Sistema de Agenda

## Problema original
Refactorizar la vista "Agenda del día" de la app web del repo `https://github.com/hm5559347-hash/AppPrueba`:
- Cambiar la vista de lista por una **tabla tipo Excel**.
- Columnas = especialistas dinámicos (BD), Filas = bloques de 60 min (08:00–20:00).
- Celdas vacías muestran botón `+` que abre el modal de Nueva Cita con `specialist_id` y hora preseleccionados por props.
- Encabezados sticky (fila de especialistas y columna de horas).
- Date picker para cambiar día visualizado.
- Estética actual conservada (Tailwind blanco/negro).

## Arquitectura
- Backend: FastAPI + MongoDB (Motor) — endpoints `/api/branches`, `/api/specialists`, `/api/services`, `/api/appointments`.
- Frontend: React + TailwindCSS + shadcn/ui.
- Auth: PIN (0000) + selección de sucursal.

## Requerimientos centrales
- Cuadrícula tipo timetable (08–20, 13 filas × N especialistas).
- Citas existentes renderizadas como card en la celda de inicio.
- Citas largas (>60 min) ocupan varias filas vía `rowSpan`.
- Filtro por especialista (reduce columnas).
- Date picker + botón HOY.
- Modal Nueva Cita reutilizable (con props `specialistId`, `startTime`, `date`).
- Acciones rápidas en card: Iniciar / Finalizar / Eliminar.
- Sticky: cabecera superior y primera columna.
- Hora fuera de turno del especialista se muestra inactiva (sin botón +).

## Implementado (07-Mayo-2026)
- `frontend/src/pages/DailyAgenda.jsx` reescrito como tabla `<table>` con `position: sticky` en `thead` y primer `<td>`.
- `frontend/src/components/NewAppointmentModal.jsx` nuevo (usa Dialog de shadcn) con todos los prefills por props.
- `rowSpan` calculado por duración de la cita (`Math.ceil(duration/60)`); celdas cubiertas se omiten.
- Date picker (`agenda-date-input`) + botón HOY (`agenda-today-btn`).
- Celdas fuera del turno del especialista: render inerte (`out-of-shift-{spId}-{h}`).
- Pestaña "Nueva Cita" del menú lateral conserva la página tradicional `/nueva-cita`.

### Servicios Adicionales (Add-ons) [07-Mayo-2026]
- Backend: modelo `Appointment.additional_services: List[AdditionalService(id, name)]` y `AppointmentUpdate.additional_services` aceptado por PATCH `/api/appointments/{id}`.
- Frontend: `lib/api.js` → `updateAppointmentExtras(id, list)`.
- `components/AppointmentDetailModal.jsx` nuevo: muestra detalle de cita (cliente/horario/especialista/servicio/estado) + sección "Servicios Adicionales" con input para añadir y botón de eliminar por extra.
- En `DailyAgenda.jsx`: clic en card abre el detail modal; los extras se renderizan como lista de viñetas dentro del card de la cita (debajo del servicio principal). Los extras NO modifican `start_time/end_time` ni el `rowSpan` de la cita.

### Citas Extemporáneas / Sobrecupo (Overbooking) [07-Mayo-2026]
- Backend: `Appointment.is_overbooked: bool = False` + `AppointmentCreate.is_overbooked` opcional. La validación de conflicto de horario en `POST /api/appointments` se OMITE cuando `is_overbooked=true` (HTTP 409 sólo en citas regulares).
- Frontend (modal Nueva Cita): toggle/checkbox `data-testid="overbooked-checkbox"`. Cuando se activa, los slots con conflicto dejan de marcarse como deshabilitados y el backend acepta el solapamiento.
- Frontend (DailyAgenda grid): el mapa `startsAt` ahora soporta múltiples citas por hora de inicio (`Array<{appt, span}>`); las celdas pueden renderizar varios cards apilados verticalmente. `rowSpan` = max(span) entre citas que comparten hora de inicio.
- Estilo distintivo para citas extra: borde `dashed`, fondo `bg-amber-50/100`, badge amarillo `EXTRA` junto al estado.

### Teléfono + Citas Flotantes + Vista Semanal mejorada [07-Mayo-2026]
- Teléfono: `client_phone` se captura en el modal Nueva Cita, en la página `/nueva-cita` (justo debajo de Nombre) y en el modal de Cita Flotante. Se muestra en `AppointmentDetailModal` como `<a href="tel:...">` clickable.
- Citas Flotantes: nuevo modelo `Appointment.is_floating`, `custom_service_name`, `custom_duration_minutes`. Backend salta validación de servicio del catálogo (servicio libre) y de conflicto cuando `is_floating=true`. Frontend: nuevo botón "Cita Flotante" en header de Agenda del Día (sky-blue) que abre `FloatingAppointmentModal.jsx` con campos: especialista, servicio (texto libre), cliente, teléfono, fecha, hora, duración (chips 15/30/45/60/90 + input numérico). Estilo visual distinto: borde sky-700 dashed, fondo `bg-sky-50/100`, badge sky-400 `FLOTANTE`.
- Vista semanal (`WeeklyAgenda` y `MyAgenda` Semana): celdas ahora ocupan múltiples filas con `rowSpan` proporcional a la duración. Se muestra nombre del servicio (custom_service_name si is_floating), nombre del cliente y nombre del especialista. Badges `FLOT`/`EXTRA` en mini-cards.

### PIN por Sucursal [07-Mayo-2026]
- Backend: `Branch.pin: Optional[str] = None` (se omite del listado público vía proyección Mongo `{pin: 0}`). Endpoints nuevos: `POST /api/branches/{id}/verify-pin` (200/401) y `PATCH /api/branches/{id}/pin` (valida 4 dígitos numéricos). Seed asigna Centro=`1111`, Norte=`2222`, Sur=`3333` con backfill idempotente.
- Frontend: nuevo `components/PinPromptDialog.jsx` (teclado numérico reutilizable con shake en error). `BranchSelector` ahora abre el dialog al hacer clic en INGRESAR; sólo navega a `/agenda` y persiste la sucursal en contexto si el PIN es correcto. Catálogo > Sucursales: nuevo botón **PIN** por card que abre `ChangeBranchPinDialog.jsx` (2 fases: PIN maestro `0000` → nuevo PIN de la sucursal).
- Eliminar sucursal: el botón de basura ahora abre `PinPromptDialog` pidiendo el PIN maestro (`0000`) antes de ejecutar `DELETE /api/branches/{id}`. Reemplaza al `window.confirm` previo.

### Servicios independientes por Sucursal [07-Mayo-2026]
- Backend: `Service.branch_id: Optional[str]` añadido. `GET /api/services?branch_id=...` filtra por sucursal (incluye legacy services sin branch_id por compatibilidad). Migración idempotente en `seed_data`: si hay servicios legacy sin branch_id, los clona a cada sucursal y elimina los originales; cada sucursal nueva queda con `SAMPLE_SERVICES` propio.
- Frontend: `lib/api.js fetchServices` acepta `params` (`{branch_id}`). Todos los callsites (`Catalog`, `DailyAgenda`, `WeeklyAgenda`, `MyAgenda`, `NewAppointment`, `NewAppointmentModal`) pasan el `branch_id` actual. Catálogo recarga al cambiar de sucursal y al crear servicio asigna `branch_id = branch.id`. Cada sucursal tiene su propio precio/duración: verificado cambiar Centro a $999 mantiene Norte en $350.

### Separación PIN de Inicio vs PIN Maestro [07-Mayo-2026]
- Backend: `APP_PIN = "1111"` (PIN de inicio / pantalla de bienvenida) y `MASTER_PIN = "0000"` (acciones administrativas: editar/eliminar sucursales, cambiar PIN de sucursal). Nuevo endpoint `POST /api/auth/verify-master-pin` (200/401) además del existente `POST /api/auth/verify-pin`.
- Frontend: `lib/api.js verifyMasterPin` añadido. `PinLock` sigue usando `verifyPin` (entry, 1111). `Catalog.handleDeleteVerify` y `ChangeBranchPinDialog` (paso 1) ahora usan `verifyMasterPin` (0000). Verificado E2E que el PIN de inicio NO autoriza acciones administrativas y viceversa.

## Backlog / Próximos
- P1: Drag & drop de citas entre celdas.
- P1: Doble-clic en card abrir modal de edición.
- P2: Vista por bloques de 30 min (toggle).
- P2: Indicador visual de "ahora" (línea horizontal sobre la hora actual).
- P3: Multi-selección de especialistas en filtro.
