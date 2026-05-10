from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# PINs
APP_PIN = "1234"      # PIN de inicio (pantalla de bienvenida)
MASTER_PIN = "0000"   # PIN maestro (acciones administrativas: editar/eliminar sucursales, etc.)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ----------------------- MODELS -----------------------
class Branch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: Optional[str] = ""
    pin: Optional[str] = None


class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    pin: Optional[str] = "0000"


class BranchPinUpdate(BaseModel):
    pin: str


class BranchPinVerify(BaseModel):
    pin: str


class Specialist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    specialty: str
    start_time: str  # "09:00"
    end_time: str    # "18:00"
    avatar_url: Optional[str] = None
    access_code: Optional[str] = None
    branch_id: Optional[str] = None


class SpecialistCreate(BaseModel):
    name: str
    specialty: str
    start_time: str
    end_time: str
    avatar_url: Optional[str] = None
    access_code: Optional[str] = None
    branch_id: Optional[str] = None


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    duration_minutes: int
    cost: Optional[float] = 0
    description: Optional[str] = ""
    branch_id: Optional[str] = None


class ServiceCreate(BaseModel):
    name: str
    duration_minutes: int
    cost: Optional[float] = 0
    description: Optional[str] = ""
    branch_id: Optional[str] = None


class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str


class AdditionalService(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    specialist_id: str
    service_id: Optional[str] = ""
    client_name: str
    client_phone: Optional[str] = ""
    date: str  # "YYYY-MM-DD"
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM" - computed
    status: str = "Confirmada"  # Confirmada | En curso | Finalizada
    branch_id: Optional[str] = None
    is_overbooked: bool = False
    is_floating: bool = False
    custom_service_name: Optional[str] = None
    custom_duration_minutes: Optional[int] = None
    additional_services: List[AdditionalService] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentCreate(BaseModel):
    specialist_id: str
    service_id: Optional[str] = ""
    client_name: str
    client_phone: Optional[str] = ""
    date: str
    start_time: str
    status: Optional[str] = "Confirmada"
    is_overbooked: Optional[bool] = False
    is_floating: Optional[bool] = False
    custom_service_name: Optional[str] = None
    custom_duration_minutes: Optional[int] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    additional_services: Optional[List[AdditionalService]] = None


class PinVerify(BaseModel):
    pin: str


class SpecialistLogin(BaseModel):
    access_code: str


# ----------------------- HELPERS -----------------------
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ALLOWED_STATUS = {"Confirmada", "En curso", "Finalizada"}
DAY_MINUTES = 24 * 60


def _validate_time(value: str, field: str = "hora") -> str:
    if not isinstance(value, str) or not TIME_RE.match(value):
        raise HTTPException(400, f"Formato de {field} inválido (esperado HH:MM)")
    return value


def _validate_date(value: str) -> str:
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise HTTPException(400, "Formato de fecha inválido (esperado YYYY-MM-DD)")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Fecha inválida")
    return value


def time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def minutes_to_time(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"


def overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and b_start < a_end


# Per-(specialist_id, date) async locks to serialise the
# read-then-write conflict check inside `create_appointment`. This prevents two
# concurrent requests from both passing the conflict check and both inserting.
_appt_locks: dict = {}
_appt_locks_master = asyncio.Lock()


async def _get_appt_lock(specialist_id: str, date: str) -> asyncio.Lock:
    key = f"{specialist_id}|{date}"
    async with _appt_locks_master:
        lock = _appt_locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            _appt_locks[key] = lock
        return lock

# ----------------------- AUTH -----------------------
@api_router.post("/auth/verify-pin")
async def verify_pin(payload: PinVerify):
    # PIN de inicio (entry PIN)
    print(f"--- Intento de login (entry) con PIN: {payload.pin} ---")
    if payload.pin == APP_PIN:
        return {"success": True}
    raise HTTPException(status_code=401, detail="PIN incorrecto")


@api_router.post("/auth/verify-master-pin")
async def verify_master_pin(payload: PinVerify):
    # PIN maestro para acciones administrativas
    print(f"--- Verificación PIN maestro: {payload.pin} ---")
    if payload.pin == MASTER_PIN:
        return {"success": True}
    raise HTTPException(status_code=401, detail="PIN maestro incorrecto")


@api_router.post("/auth/specialist-login", response_model=Specialist)
async def specialist_login(payload: SpecialistLogin):
    print(f"--- Intento de login Especialista: {payload.access_code} ---")
    code = (payload.access_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Código requerido")
    sp = await db.specialists.find_one({"access_code": code}, {"_id": 0})
    if not sp:
        raise HTTPException(status_code=401, detail="Código inválido")
    return sp

# ----------------------- BRANCHES -----------------------
@api_router.post("/branches", response_model=Branch)
async def create_branch(payload: BranchCreate):
    br = Branch(**payload.model_dump())
    await db.branches.insert_one(br.model_dump())
    return br


@api_router.get("/branches", response_model=List[Branch])
async def list_branches():
    # Exclude pin from public listing
    docs = await db.branches.find({}, {"_id": 0, "pin": 0}).to_list(500)
    return docs


@api_router.post("/branches/{branch_id}/verify-pin")
async def verify_branch_pin(branch_id: str, payload: BranchPinVerify):
    existing = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Sucursal no encontrada")
    expected = (existing.get("pin") or "").strip()
    received = (payload.pin or "").strip()
    if not expected or expected != received:
        raise HTTPException(401, "PIN incorrecto")
    return {"success": True}


@api_router.patch("/branches/{branch_id}/pin")
async def update_branch_pin(branch_id: str, payload: BranchPinUpdate):
    existing = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Sucursal no encontrada")
    new_pin = (payload.pin or "").strip()
    if not new_pin.isdigit() or len(new_pin) != 4:
        raise HTTPException(400, "PIN debe ser exactamente 4 dígitos numéricos")
    await db.branches.update_one({"id": branch_id}, {"$set": {"pin": new_pin}})
    return {"success": True}


@api_router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, payload: BranchCreate):
    existing = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Sucursal no encontrada")
    await db.branches.update_one({"id": branch_id}, {"$set": payload.model_dump()})
    return {**existing, **payload.model_dump()}


@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str):
    # Prevent delete if has specialists or appointments
    has_sp = await db.specialists.find_one({"branch_id": branch_id}, {"_id": 0})
    if has_sp:
        raise HTTPException(400, "La sucursal tiene especialistas asignados")
    has_ap = await db.appointments.find_one({"branch_id": branch_id}, {"_id": 0})
    if has_ap:
        raise HTTPException(400, "La sucursal tiene citas registradas")
    res = await db.branches.delete_one({"id": branch_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Sucursal no encontrada")
    return {"success": True}


# ----------------------- SPECIALISTS -----------------------
@api_router.post("/specialists", response_model=Specialist)
async def create_specialist(payload: SpecialistCreate):
    sp = Specialist(**payload.model_dump())
    await db.specialists.insert_one(sp.model_dump())
    return sp


@api_router.get("/specialists", response_model=List[Specialist])
async def list_specialists(branch_id: Optional[str] = None):
    q = {}
    if branch_id:
        q["branch_id"] = branch_id
    docs = await db.specialists.find(q, {"_id": 0}).to_list(500)
    return docs


@api_router.put("/specialists/{specialist_id}", response_model=Specialist)
async def update_specialist(specialist_id: str, payload: SpecialistCreate):
    existing = await db.specialists.find_one({"id": specialist_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Especialista no encontrado")
    updated = {**existing, **payload.model_dump()}
    await db.specialists.update_one({"id": specialist_id}, {"$set": payload.model_dump()})
    return updated


@api_router.delete("/specialists/{specialist_id}")
async def delete_specialist(specialist_id: str):
    res = await db.specialists.delete_one({"id": specialist_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Especialista no encontrado")
    return {"success": True}


# ----------------------- SERVICES -----------------------
@api_router.post("/services", response_model=Service)
async def create_service(payload: ServiceCreate):
    sv = Service(**payload.model_dump())
    await db.services.insert_one(sv.model_dump())
    return sv


@api_router.get("/services", response_model=List[Service])
async def list_services(branch_id: Optional[str] = None):
    q = {}
    if branch_id:
        # include legacy services without branch_id (None) so they don't disappear during migration
        q = {"$or": [{"branch_id": branch_id}, {"branch_id": None}, {"branch_id": ""}]}
    docs = await db.services.find(q, {"_id": 0}).to_list(500)
    return docs


@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, payload: ServiceCreate):
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Servicio no encontrado")
    await db.services.update_one({"id": service_id}, {"$set": payload.model_dump()})
    return {**existing, **payload.model_dump()}


@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    res = await db.services.delete_one({"id": service_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Servicio no encontrado")
    return {"success": True}


# ----------------------- CLIENTS -----------------------
@api_router.get("/clients", response_model=List[Client])
async def list_clients(q: Optional[str] = None):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q}}
        ]}
    docs = await db.clients.find(query, {"_id": 0}).to_list(500)
    docs.sort(key=lambda x: x.get("name", "").lower())
    return docs


# ----------------------- APPOINTMENTS -----------------------
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate):
    # ---- Input validation ----
    _validate_date(payload.date)
    _validate_time(payload.start_time, "hora de inicio")
    if not (payload.client_name or "").strip():
        raise HTTPException(400, "Nombre del cliente requerido")

    # Validate specialist exists
    specialist = await db.specialists.find_one({"id": payload.specialist_id}, {"_id": 0})
    if not specialist:
        raise HTTPException(400, "Especialista no encontrado")

    # Validate specialist's own schedule format (defensive)
    _validate_time(specialist.get("start_time", ""), "turno especialista")
    _validate_time(specialist.get("end_time", ""), "turno especialista")

    is_floating = bool(payload.is_floating)
    if is_floating:
        if not payload.custom_service_name or not payload.custom_duration_minutes:
            raise HTTPException(400, "Cita flotante requiere nombre del servicio y duración")
        try:
            duration = int(payload.custom_duration_minutes)
        except (TypeError, ValueError):
            raise HTTPException(400, "Duración inválida")
        if duration <= 0 or duration > DAY_MINUTES:
            raise HTTPException(400, "Duración fuera de rango (1 — 1440 min)")
        service_id_value = ""
    else:
        if not payload.service_id:
            raise HTTPException(400, "Servicio requerido")
        service = await db.services.find_one({"id": payload.service_id}, {"_id": 0})
        if not service:
            raise HTTPException(400, "Servicio no encontrado")
        try:
            duration = int(service["duration_minutes"])
        except (TypeError, ValueError, KeyError):
            raise HTTPException(400, "Duración del servicio inválida")
        if duration <= 0 or duration > DAY_MINUTES:
            raise HTTPException(400, "Duración del servicio fuera de rango")
        service_id_value = payload.service_id

    start_min = time_to_minutes(payload.start_time)
    end_min = start_min + duration
    if end_min > DAY_MINUTES:
        raise HTTPException(400, "La cita se extiende más allá del día")
    end_time_str = minutes_to_time(end_min)

    # Validate within specialist's schedule
    sp_start = time_to_minutes(specialist["start_time"])
    sp_end = time_to_minutes(specialist["end_time"])
    if start_min < sp_start or end_min > sp_end:
        raise HTTPException(
            400,
            f"Horario fuera del turno del especialista ({specialist['start_time']} - {specialist['end_time']})"
        )

    # Validate status
    status_value = payload.status or "Confirmada"
    if status_value not in ALLOWED_STATUS:
        raise HTTPException(400, f"Estado inválido. Permitidos: {sorted(ALLOWED_STATUS)}")

    # Conflict check + insert under a per-(specialist, date) lock to avoid
    # the read-then-write race condition between concurrent requests.
    skip_conflict = bool(payload.is_overbooked) or is_floating
    lock = await _get_appt_lock(payload.specialist_id, payload.date)
    async with lock:
        if not skip_conflict:
            existing_appts = await db.appointments.find(
                {"specialist_id": payload.specialist_id, "date": payload.date,
                 "is_overbooked": {"$ne": True}, "is_floating": {"$ne": True}},
                {"_id": 0}
            ).to_list(500)

            for a in existing_appts:
                a_start = time_to_minutes(a["start_time"])
                a_end = time_to_minutes(a["end_time"])
                if overlaps(start_min, end_min, a_start, a_end):
                    raise HTTPException(
                        409,
                        f"Conflicto: el especialista ya tiene una cita de {a['start_time']} a {a['end_time']}"
                    )

        appt = Appointment(
            specialist_id=payload.specialist_id,
            service_id=service_id_value,
            client_name=payload.client_name.strip(),
            client_phone=(payload.client_phone or "").strip(),
            date=payload.date,
            start_time=payload.start_time,
            end_time=end_time_str,
            status=status_value,
            branch_id=specialist.get("branch_id"),
            is_overbooked=bool(payload.is_overbooked) or is_floating,
            is_floating=is_floating,
            custom_service_name=payload.custom_service_name if is_floating else None,
            custom_duration_minutes=duration if is_floating else None,
        )
        doc = appt.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.appointments.insert_one(doc)

    # Upsert client by phone (if provided) to build a directory
    phone = (payload.client_phone or "").strip()
    if phone:
        existing_client = await db.clients.find_one({"phone": phone}, {"_id": 0})
        if existing_client:
            # Update name in case it changed
            if existing_client.get("name") != payload.client_name:
                await db.clients.update_one(
                    {"id": existing_client["id"]},
                    {"$set": {"name": payload.client_name.strip()}}
                )
        else:
            client_obj = Client(name=payload.client_name.strip(), phone=phone)
            await db.clients.insert_one(client_obj.model_dump())

    return appt


@api_router.get("/appointments", response_model=List[Appointment])
async def list_appointments(date: Optional[str] = None, week_start: Optional[str] = None, branch_id: Optional[str] = None):
    q = {}
    if date:
        _validate_date(date)
        q["date"] = date
    elif week_start:
        _validate_date(week_start)
        # 7 day range
        start_d = datetime.strptime(week_start, "%Y-%m-%d")
        dates = [(start_d + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        q["date"] = {"$in": dates}
    if branch_id:
        q["branch_id"] = branch_id
    docs = await db.appointments.find(q, {"_id": 0}).to_list(1000)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            try:
                d["created_at"] = datetime.fromisoformat(d["created_at"])
            except ValueError:
                d["created_at"] = datetime.now(timezone.utc)
    # Stable ordering: date, start_time, then created_at to keep extras/floating
    # rendered in the order they were added when multiple share a slot.
    docs.sort(key=lambda x: (
        x.get("date", ""),
        x.get("start_time", ""),
        x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc),
    ))
    return docs


@api_router.patch("/appointments/{appt_id}", response_model=Appointment)
async def update_appointment(appt_id: str, payload: AppointmentUpdate):
    existing = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Cita no encontrada")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "status" in update and update["status"] not in ALLOWED_STATUS:
        raise HTTPException(400, f"Estado inválido. Permitidos: {sorted(ALLOWED_STATUS)}")
    if update:
        await db.appointments.update_one({"id": appt_id}, {"$set": update})
        existing.update(update)
    if isinstance(existing.get("created_at"), str):
        try:
            existing["created_at"] = datetime.fromisoformat(existing["created_at"])
        except ValueError:
            existing["created_at"] = datetime.now(timezone.utc)
    return existing


@api_router.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str):
    res = await db.appointments.delete_one({"id": appt_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Cita no encontrada")
    return {"success": True}


# ----------------------- SEED -----------------------
SAMPLE_BRANCHES = [
    {"name": "Manuel & Torres · Centro", "address": "Av. Reforma 123, Centro", "pin": "1111"},
    {"name": "Manuel & Torres · Norte", "address": "Plaza Norte, Local 22", "pin": "2222"},
    {"name": "Manuel & Torres · Sur", "address": "Av. del Sur 456, Col. Jardines", "pin": "3333"},
]

SAMPLE_SPECIALISTS = [
    {"name": "Sofía Vargas", "specialty": "Colorimetría", "start_time": "09:00", "end_time": "18:00",
     "avatar_url": "https://images.unsplash.com/photo-1683348758606-860c720fda9a?crop=entropy&cs=srgb&fm=jpg&w=400",
     "access_code": "1001", "branch_index": 0},
    {"name": "Lucía Martín", "specialty": "Peinado & Corte", "start_time": "10:00", "end_time": "19:00",
     "avatar_url": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=srgb&fm=jpg&w=400",
     "access_code": "1002", "branch_index": 0},
    {"name": "Andrés Núñez", "specialty": "Barbería", "start_time": "08:00", "end_time": "16:00",
     "avatar_url": "https://images.unsplash.com/photo-1622902046580-2b47f47f5471?crop=entropy&cs=srgb&fm=jpg&w=400",
     "access_code": "1003", "branch_index": 1},
    {"name": "Camila Reyes", "specialty": "Manicure & Spa", "start_time": "11:00", "end_time": "20:00",
     "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=srgb&fm=jpg&w=400",
     "access_code": "1004", "branch_index": 2},
]

SAMPLE_SERVICES = [
    {"name": "Corte de Cabello", "duration_minutes": 45, "cost": 350, "description": "Corte y estilizado profesional"},
    {"name": "Tinte Completo", "duration_minutes": 90, "cost": 1200, "description": "Coloración de raíz a puntas"},
    {"name": "Mechas / Balayage", "duration_minutes": 120, "cost": 2200, "description": "Técnica de iluminación natural"},
    {"name": "Peinado para Evento", "duration_minutes": 60, "cost": 850, "description": "Peinado sofisticado para ocasión especial"},
    {"name": "Manicure Gel", "duration_minutes": 50, "cost": 450, "description": "Esmaltado semipermanente en gel"},
    {"name": "Tratamiento Capilar", "duration_minutes": 45, "cost": 650, "description": "Hidratación profunda y brillo"},
]


async def seed_data():
    # Branches
    br_count = await db.branches.count_documents({})
    if br_count == 0:
        for b in SAMPLE_BRANCHES:
            br = Branch(**b)
            await db.branches.insert_one(br.model_dump())
    else:
        # Backfill pin on existing branches by matching name
        for b in SAMPLE_BRANCHES:
            await db.branches.update_one(
                {"name": b["name"], "$or": [{"pin": {"$exists": False}}, {"pin": None}, {"pin": ""}]},
                {"$set": {"pin": b["pin"]}},
            )
    branches = await db.branches.find({}, {"_id": 0}).to_list(20)

    # Specialists
    sp_count = await db.specialists.count_documents({})
    if sp_count == 0 and branches:
        for s in SAMPLE_SPECIALISTS:
            idx = s.pop("branch_index", 0)
            branch_id = branches[idx % len(branches)]["id"]
            sp = Specialist(branch_id=branch_id, **s)
            await db.specialists.insert_one(sp.model_dump())
    else:
        # Backfill access_code and branch_id for existing seeded specialists by name
        for s in SAMPLE_SPECIALISTS:
            idx = s.get("branch_index", 0)
            branch_id = branches[idx % len(branches)]["id"] if branches else None
            update_fields = {}
            existing = await db.specialists.find_one({"name": s["name"]}, {"_id": 0})
            if existing:
                if not existing.get("access_code"):
                    update_fields["access_code"] = s["access_code"]
                if not existing.get("branch_id") and branch_id:
                    update_fields["branch_id"] = branch_id
                if update_fields:
                    await db.specialists.update_one({"name": s["name"]}, {"$set": update_fields})
        # Also backfill any specialist missing branch_id to first branch
        if branches:
            await db.specialists.update_many(
                {"$or": [{"branch_id": None}, {"branch_id": {"$exists": False}}]},
                {"$set": {"branch_id": branches[0]["id"]}}
            )

    # Services (per-branch)
    if branches:
        # 1) Migrate legacy services without branch_id: replicate to each branch then delete originals
        legacy = await db.services.find(
            {"$or": [{"branch_id": None}, {"branch_id": ""}, {"branch_id": {"$exists": False}}]},
            {"_id": 0},
        ).to_list(1000)
        if legacy:
            for sv in legacy:
                for br in branches:
                    clone = {**sv, "id": str(uuid.uuid4()), "branch_id": br["id"]}
                    await db.services.insert_one(clone)
            await db.services.delete_many(
                {"$or": [{"branch_id": None}, {"branch_id": ""}, {"branch_id": {"$exists": False}}]}
            )

        # 2) Ensure each branch has at least the SAMPLE_SERVICES catalog
        for br in branches:
            br_count = await db.services.count_documents({"branch_id": br["id"]})
            if br_count == 0:
                for s in SAMPLE_SERVICES:
                    sv = Service(branch_id=br["id"], **s)
                    await db.services.insert_one(sv.model_dump())

    # Backfill branch_id on appointments based on their specialist
    appts_without_branch = await db.appointments.find(
        {"$or": [{"branch_id": None}, {"branch_id": {"$exists": False}}]},
        {"_id": 0}
    ).to_list(1000)
    for a in appts_without_branch:
        sp = await db.specialists.find_one({"id": a["specialist_id"]}, {"_id": 0})
        if sp and sp.get("branch_id"):
            await db.appointments.update_one(
                {"id": a["id"]}, {"$set": {"branch_id": sp["branch_id"]}}
            )

    # Sample appointments for today (only if none)
    appt_count = await db.appointments.count_documents({})
    if appt_count == 0:
        specialists = await db.specialists.find({}, {"_id": 0}).to_list(10)
        services = await db.services.find({}, {"_id": 0}).to_list(10)
        if specialists and services:
            today = datetime.now().strftime("%Y-%m-%d")
            samples = [
                (specialists[0], services[0], "María González", "10:00"),
                (specialists[0], services[1], "Patricia López", "14:00"),
                (specialists[1], services[3], "Roberto Silva", "11:30"),
                (specialists[2], services[0], "Ana Castro", "09:00"),
                (specialists[3], services[4], "Laura Méndez", "13:00"),
            ]
            for sp, sv, client, start in samples:
                start_min = time_to_minutes(start)
                end_min = start_min + sv["duration_minutes"]
                appt = Appointment(
                    specialist_id=sp["id"],
                    service_id=sv["id"],
                    client_name=client,
                    date=today,
                    start_time=start,
                    end_time=minutes_to_time(end_min),
                    status="Confirmada",
                    branch_id=sp.get("branch_id"),
                )
                doc = appt.model_dump()
                doc["created_at"] = doc["created_at"].isoformat()
                await db.appointments.insert_one(doc)


@api_router.post("/seed")
async def trigger_seed():
    await seed_data()
    return {"success": True}


@api_router.get("/")
async def root():
    return {"message": "Clinic API", "ok": True}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    try:
        # Indexes for fast appointment lookups (idempotent)
        await db.appointments.create_index([("specialist_id", 1), ("date", 1)])
        await db.appointments.create_index([("branch_id", 1), ("date", 1)])
        await db.appointments.create_index([("date", 1), ("start_time", 1)])
        await db.appointments.create_index("id", unique=True)
        await db.specialists.create_index("id", unique=True)
        await db.specialists.create_index("access_code")
        await db.services.create_index("id", unique=True)
        await db.branches.create_index("id", unique=True)
        await db.clients.create_index("phone")
        logger.info("Indexes ensured")
    except Exception as e:
        logger.error(f"Index creation failed: {e}")
    try:
        await seed_data()
        logger.info("Seed completed")
    except Exception as e:
        logger.error(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
