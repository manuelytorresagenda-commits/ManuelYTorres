from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse
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
MASTER_PIN = "0000"   # PIN maestro (acciones administrativas)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ----------------------- HEALTHCHECKS ULTRALIGEROS (BLINDAJE CRON) -----------------------
@app.api_route("/health", methods=["GET", "HEAD"], response_class=PlainTextResponse)
async def app_health():
    return "ok"

@api_router.api_route("/health", methods=["GET", "HEAD"], response_class=PlainTextResponse)
async def api_health():
    return "ok"

@app.api_route("/", methods=["GET", "HEAD"])
async def app_root():
    return {"status": "ok", "app": "Manuel & Torres API"}

@api_router.api_route("/", methods=["GET", "HEAD"])
async def router_root():
    return {"status": "ok", "router": "api"}


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
    order: Optional[int] = 99


class SpecialistCreate(BaseModel):
    name: str
    specialty: str
    start_time: str
    end_time: str
    avatar_url: Optional[str] = None
    access_code: Optional[str] = None
    branch_id: Optional[str] = None
    order: Optional[int] = 99


class Receptionist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch_id: Optional[str] = None
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "18:00"
    avatar_url: Optional[str] = None


class ReceptionistCreate(BaseModel):
    name: str
    branch_id: Optional[str] = None
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "18:00"
    avatar_url: Optional[str] = None


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
    phone: Optional[str] = ""
    instagram: Optional[str] = ""
    tiktok: Optional[str] = ""
    birthday: Optional[str] = ""  # "YYYY-MM-DD" or "MM-DD" or ""


class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    instagram: Optional[str] = ""
    tiktok: Optional[str] = ""
    birthday: Optional[str] = ""


class AdditionalService(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    specialist_id: str
    service_id: Optional[str] = ""
    client_name: str
    client_phone: Optional[str] = ""
    client_instagram: Optional[str] = ""
    client_tiktok: Optional[str] = ""
    client_birthday: Optional[str] = ""
    date: str  # "YYYY-MM-DD"
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM" - computed
    status: str = "Confirmada"  # Confirmada | En curso | Finalizada
    branch_id: Optional[str] = None
    is_overbooked: bool = False
    is_floating: bool = False
    custom_service_name: Optional[str] = None
    custom_duration_minutes: Optional[int] = None
    receptionist_name: Optional[str] = None
    created_by: Optional[str] = None
    additional_services: List[AdditionalService] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentCreate(BaseModel):
    specialist_id: str
    service_id: Optional[str] = ""
    client_name: str
    client_phone: Optional[str] = ""
    client_instagram: Optional[str] = ""
    client_tiktok: Optional[str] = ""
    client_birthday: Optional[str] = ""
    date: str
    start_time: str
    status: Optional[str] = "Confirmada"
    is_overbooked: Optional[bool] = False
    is_floating: Optional[bool] = False
    custom_service_name: Optional[str] = None
    custom_duration_minutes: Optional[int] = None
    receptionist_name: Optional[str] = None
    created_by: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_instagram: Optional[str] = None
    client_tiktok: Optional[str] = None
    client_birthday: Optional[str] = None
    receptionist_name: Optional[str] = None
    additional_services: Optional[List[AdditionalService]] = None


class AppointmentReschedule(BaseModel):
    specialist_id: Optional[str] = None
    date: str
    start_time: str


class Vacation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    specialist_id: str
    specialist_name: Optional[str] = ""
    start_date: str  # "YYYY-MM-DD"
    end_date: str    # "YYYY-MM-DD"
    reason: Optional[str] = "Vacaciones"
    branch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VacationCreate(BaseModel):
    specialist_id: str
    start_date: str
    end_date: str
    reason: Optional[str] = "Vacaciones"


class Coverage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_branch_id: str
    is_guest: bool = False  # False = Estilista interno de otra sucursal, True = Invitado externo
    specialist_id: Optional[str] = None
    guest_name: Optional[str] = ""
    specialty: Optional[str] = "Estilista"
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "18:00"
    start_date: str  # "YYYY-MM-DD"
    end_date: str    # "YYYY-MM-DD"
    reason: Optional[str] = "Apoyo"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CoverageCreate(BaseModel):
    target_branch_id: str
    is_guest: Optional[bool] = False
    specialist_id: Optional[str] = None
    guest_name: Optional[str] = ""
    specialty: Optional[str] = "Estilista"
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "18:00"
    start_date: str
    end_date: str
    reason: Optional[str] = "Apoyo"


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


def _normalize_handle(value: Optional[str]) -> str:
    v = (value or "").strip()
    if v.startswith("@"):
        v = v[1:].strip()
    return v


BIRTHDAY_RE = re.compile(
    r"^(?:|"
    r"\d{4}-\d{2}-\d{2}|"
    r"\d{2}-\d{2}|"
    r"\d{2}/\d{2}|"
    r"\d{2}/\d{2}/\d{4}"
    r")$"
)


def _normalize_birthday(value: Optional[str]) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    if not BIRTHDAY_RE.match(v):
        raise HTTPException(400, "Cumpleaños inválido (use YYYY-MM-DD, MM-DD o DD/MM/YYYY)")
    return v


async def _upsert_client(name: str, phone: str, instagram: str, tiktok: str, birthday: str) -> None:
    if not name:
        return
    
    clean_name = name.strip()
    clean_phone = (phone or "").strip()
    
    query = {"name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}}
    if clean_phone:
        query["phone"] = clean_phone

    existing = await db.clients.find_one(query, {"_id": 0})

    if existing:
        update_fields: dict = {}
        if instagram and existing.get("instagram") != instagram:
            update_fields["instagram"] = instagram
        if tiktok and existing.get("tiktok") != tiktok:
            update_fields["tiktok"] = tiktok
        if birthday and existing.get("birthday") != birthday:
            update_fields["birthday"] = birthday
            
        if update_fields:
            await db.clients.update_one({"id": existing["id"]}, {"$set": update_fields})
            
    else:
        client_obj = Client(
            name=clean_name, 
            phone=clean_phone, 
            instagram=instagram, 
            tiktok=tiktok, 
            birthday=birthday
        )
        await db.clients.insert_one(client_obj.model_dump())


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
    if payload.pin == APP_PIN:
        return {"success": True}
    raise HTTPException(status_code=401, detail="PIN incorrecto")


@api_router.post("/auth/verify-master-pin")
async def verify_master_pin(payload: PinVerify):
    if payload.pin == MASTER_PIN:
        return {"success": True}
    raise HTTPException(status_code=401, detail="PIN maestro incorrecto")


@api_router.post("/auth/specialist-login", response_model=Specialist)
async def specialist_login(payload: SpecialistLogin):
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


@api_router.get("/branches")
async def list_branches():
    docs = await db.branches.find({}, {"_id": 0}).to_list(500)
    for d in docs:
        d.pop("pin", None)
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
    docs = await db.specialists.find(q, {"_id": 0}).sort([("order", 1), ("name", 1)]).to_list(500)
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


# ----------------------- RECEPTIONISTS -----------------------
@api_router.post("/receptionists", response_model=Receptionist)
async def create_receptionist(payload: ReceptionistCreate):
    rec = Receptionist(**payload.model_dump())
    await db.receptionists.insert_one(rec.model_dump())
    return rec


@api_router.get("/receptionists", response_model=List[Receptionist])
async def list_receptionists(branch_id: Optional[str] = None):
    q = {}
    if branch_id:
        q["branch_id"] = branch_id
    docs = await db.receptionists.find(q, {"_id": 0}).to_list(500)
    return docs


@api_router.put("/receptionists/{receptionist_id}", response_model=Receptionist)
async def update_receptionist(receptionist_id: str, payload: ReceptionistCreate):
    existing = await db.receptionists.find_one({"id": receptionist_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Recepcionista no encontrada")
    updated = {**existing, **payload.model_dump()}
    await db.receptionists.update_one({"id": receptionist_id}, {"$set": payload.model_dump()})
    return updated


@api_router.delete("/receptionists/{receptionist_id}")
async def delete_receptionist(receptionist_id: str):
    res = await db.receptionists.delete_one({"id": receptionist_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Recepcionista no encontrada")
    return {"success": True}


# ----------------------- SERVICES -----------------------
@api_router.post("/services", response_model=Service)
async def create_service(payload: ServiceCreate):
    sv = Service(**payload.model_dump())
    await db.services.insert_one(sv.model_dump())
    return sv


@api_router.get("/services", response_model=List[Service])
async def list_services(branch_id: Optional[str] = None):
    docs = await db.services.find({}, {"_id": 0}).to_list(500)
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
@api_router.post("/clients", response_model=Client)
async def create_client(payload: ClientCreate):
    name_clean = (payload.name or "").strip()
    if not name_clean:
        raise HTTPException(400, "Nombre del cliente requerido")

    phone_clean = (payload.phone or "").strip()
    instagram_clean = _normalize_handle(payload.instagram)
    tiktok_clean = _normalize_handle(payload.tiktok)
    birthday_clean = _normalize_birthday(payload.birthday)

    await _upsert_client(
        name=name_clean,
        phone=phone_clean,
        instagram=instagram_clean,
        tiktok=tiktok_clean,
        birthday=birthday_clean,
    )

    query = {"name": {"$regex": f"^{re.escape(name_clean)}$", "$options": "i"}}
    if phone_clean:
        query["phone"] = phone_clean
    doc = await db.clients.find_one(query, {"_id": 0})
    return doc


@api_router.get("/clients", response_model=List[Client])
async def list_clients(q: Optional[str] = None, limit: int = 20):
    query = {}
    if q:
        safe = re.escape(q.strip())
        if safe:
            query = {"$or": [
                {"name": {"$regex": safe, "$options": "i"}},
                {"phone": {"$regex": safe}},
                {"instagram": {"$regex": safe, "$options": "i"}},
                {"tiktok": {"$regex": safe, "$options": "i"}},
            ]}
    docs = await db.clients.find(query, {"_id": 0}).to_list(500)
    q_norm = (q or "").strip().lower()
    def _rank(c):
        name = (c.get("name") or "").lower()
        if q_norm and name.startswith(q_norm):
            return (0, name)
        if q_norm and q_norm in name:
            return (1, name)
        return (2, name)
    docs.sort(key=_rank)
    return docs[: max(1, min(limit, 100))]


# ----------------------- VACATIONS -----------------------
@api_router.post("/vacations", response_model=Vacation)
async def create_vacation(payload: VacationCreate):
    _validate_date(payload.start_date)
    _validate_date(payload.end_date)
    
    if payload.start_date > payload.end_date:
        raise HTTPException(400, "La fecha de inicio no puede ser posterior a la de fin")

    specialist = await db.specialists.find_one({"id": payload.specialist_id}, {"_id": 0})
    if not specialist:
        raise HTTPException(400, "Especialista no encontrado")

    vacation = Vacation(
        specialist_id=payload.specialist_id,
        specialist_name=specialist.get("name", ""),
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason or "Vacaciones",
        branch_id=specialist.get("branch_id"),
    )
    doc = vacation.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.vacations.insert_one(doc)
    return vacation


@api_router.get("/vacations", response_model=List[Vacation])
async def list_vacations(
    date: Optional[str] = None,
    week_start: Optional[str] = None,
    specialist_id: Optional[str] = None,
    branch_id: Optional[str] = None
):
    q = {}
    if branch_id:
        q["branch_id"] = branch_id
    if specialist_id:
        q["specialist_id"] = specialist_id

    if date:
        _validate_date(date)
        q["start_date"] = {"$lte": date}
        q["end_date"] = {"$gte": date}
    elif week_start:
        _validate_date(week_start)
        start_d = datetime.strptime(week_start, "%Y-%m-%d")
        week_end = (start_d + timedelta(days=6)).strftime("%Y-%m-%d")
        q["start_date"] = {"$lte": week_end}
        q["end_date"] = {"$gte": week_start}

    docs = await db.vacations.find(q, {"_id": 0}).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            try:
                d["created_at"] = datetime.fromisoformat(d["created_at"])
            except ValueError:
                d["created_at"] = datetime.now(timezone.utc)
    return docs


@api_router.delete("/vacations/{vacation_id}")
async def delete_vacation(vacation_id: str):
    res = await db.vacations.delete_one({"id": vacation_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Registro de vacaciones no encontrado")
    return {"success": True}


@api_router.delete("/vacations/{vacation_id}/single-day")
async def cancel_vacation_single_day(vacation_id: str, date: str):
    _validate_date(date)
    vac = await db.vacations.find_one({"id": vacation_id}, {"_id": 0})
    if not vac:
        raise HTTPException(404, "Registro de vacaciones no encontrado")
    
    start_d = datetime.strptime(vac["start_date"], "%Y-%m-%d").date()
    end_d = datetime.strptime(vac["end_date"], "%Y-%m-%d").date()
    target_d = datetime.strptime(date, "%Y-%m-%d").date()

    if target_d < start_d or target_d > end_d:
        raise HTTPException(400, "La fecha indicada no cae dentro de este periodo de vacaciones")

    # Caso 1: Vacación de 1 solo día -> se borra el registro completo
    if start_d == end_d:
        await db.vacations.delete_one({"id": vacation_id})
        return {"success": True, "message": "Vacación eliminada"}

    # Caso 2: Se cancela el primer día del rango -> mover start_date 1 día adelante
    if target_d == start_d:
        new_start = (start_d + timedelta(days=1)).strftime("%Y-%m-%d")
        await db.vacations.update_one({"id": vacation_id}, {"$set": {"start_date": new_start}})
        return {"success": True, "message": "Día inicial removido del rango"}

    # Caso 3: Se cancela el último día del rango -> mover end_date 1 día atrás
    if target_d == end_d:
        new_end = (end_d - timedelta(days=1)).strftime("%Y-%m-%d")
        await db.vacations.update_one({"id": vacation_id}, {"$set": {"end_date": new_end}})
        return {"success": True, "message": "Día final removido del rango"}

    # Caso 4: Se cancela un día intermedio -> Dividir en dos rangos
    first_end = (target_d - timedelta(days=1)).strftime("%Y-%m-%d")
    second_start = (target_d + timedelta(days=1)).strftime("%Y-%m-%d")

    # Acortar el actual
    await db.vacations.update_one({"id": vacation_id}, {"$set": {"end_date": first_end}})

    # Insertar el nuevo tramo posterior
    new_vac = Vacation(
        specialist_id=vac["specialist_id"],
        specialist_name=vac.get("specialist_name", ""),
        start_date=second_start,
        end_date=vac["end_date"],
        reason=vac.get("reason", "Vacaciones"),
        branch_id=vac.get("branch_id"),
    )
    new_doc = new_vac.model_dump()
    new_doc["created_at"] = new_doc["created_at"].isoformat()
    await db.vacations.insert_one(new_doc)

    return {"success": True, "message": "Día intermedio removido y periodo dividido"}


# ----------------------- COVERAGES / GUEST SPECIALISTS -----------------------
@api_router.post("/coverages", response_model=Coverage)
async def create_coverage(payload: CoverageCreate):
    _validate_date(payload.start_date)
    _validate_date(payload.end_date)
    
    if payload.start_date > payload.end_date:
        raise HTTPException(400, "La fecha de inicio no puede ser posterior a la de fin")

    target_br = await db.branches.find_one({"id": payload.target_branch_id}, {"_id": 0})
    if not target_br:
        raise HTTPException(400, "Sucursal destino no encontrada")

    if not payload.is_guest:
        if not payload.specialist_id:
            raise HTTPException(400, "Especialista interno requerido")
        sp = await db.specialists.find_one({"id": payload.specialist_id}, {"_id": 0})
        if not sp:
            raise HTTPException(400, "Especialista no encontrado")
        guest_name = sp.get("name", "")
        specialty = sp.get("specialty", "Estilista")
        start_time = sp.get("start_time", "09:00")
        end_time = sp.get("end_time", "18:00")
    else:
        guest_name = (payload.guest_name or "").strip()
        if not guest_name:
            raise HTTPException(400, "Nombre del estilista invitado requerido")
        specialty = (payload.specialty or "Estilista Invitado").strip()
        start_time = _validate_time(payload.start_time or "09:00", "hora inicio")
        end_time = _validate_time(payload.end_time or "18:00", "hora fin")

    cov = Coverage(
        target_branch_id=payload.target_branch_id,
        is_guest=bool(payload.is_guest),
        specialist_id=payload.specialist_id if not payload.is_guest else None,
        guest_name=guest_name,
        specialty=specialty,
        start_time=start_time,
        end_time=end_time,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason or "Apoyo",
    )
    doc = cov.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.coverages.insert_one(doc)
    return cov


@api_router.get("/coverages", response_model=List[Coverage])
async def list_coverages(
    date: Optional[str] = None,
    week_start: Optional[str] = None,
    target_branch_id: Optional[str] = None
):
    q = {}
    if target_branch_id:
        q["target_branch_id"] = target_branch_id

    if date:
        _validate_date(date)
        q["start_date"] = {"$lte": date}
        q["end_date"] = {"$gte": date}
    elif week_start:
        _validate_date(week_start)
        start_d = datetime.strptime(week_start, "%Y-%m-%d")
        week_end = (start_d + timedelta(days=6)).strftime("%Y-%m-%d")
        q["start_date"] = {"$lte": week_end}
        q["end_date"] = {"$gte": week_start}

    docs = await db.coverages.find(q, {"_id": 0}).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            try:
                d["created_at"] = datetime.fromisoformat(d["created_at"])
            except ValueError:
                d["created_at"] = datetime.now(timezone.utc)
    return docs


@api_router.delete("/coverages/{coverage_id}")
async def delete_coverage(coverage_id: str):
    res = await db.coverages.delete_one({"id": coverage_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Registro de apoyo no encontrado")
    return {"success": True}


# ----------------------- APPOINTMENTS -----------------------
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate):
    _validate_date(payload.date)
    _validate_time(payload.start_time, "hora de inicio")
    if not (payload.client_name or "").strip():
        raise HTTPException(400, "Nombre del cliente requerido")

    specialist = await db.specialists.find_one({"id": payload.specialist_id}, {"_id": 0})

    if not specialist:
        cov = await db.coverages.find_one({
            "id": payload.specialist_id,
            "start_date": {"$lte": payload.date},
            "end_date": {"$gte": payload.date}
        }, {"_id": 0})
        if cov:
            specialist = {
                "id": cov["id"],
                "name": cov.get("guest_name", "Invitado"),
                "specialty": cov.get("specialty", "Estilista"),
                "start_time": cov.get("start_time", "09:00"),
                "end_time": cov.get("end_time", "18:00"),
                "branch_id": cov.get("target_branch_id"),
            }
        else:
            raise HTTPException(400, "Especialista o invitado no encontrado / no activo en esta fecha")

    # Verificar si está de vacaciones
    vacation = await db.vacations.find_one({
        "specialist_id": payload.specialist_id,
        "start_date": {"$lte": payload.date},
        "end_date": {"$gte": payload.date}
    }, {"_id": 0})
    if vacation:
        reason = vacation.get("reason") or "Vacaciones"
        raise HTTPException(400, f"{specialist.get('name', 'El especialista')} no está disponible el {payload.date} ({reason}).")

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

    sp_start = time_to_minutes(specialist["start_time"])
    sp_end = time_to_minutes(specialist["end_time"])
    if start_min < sp_start or end_min > sp_end:
        raise HTTPException(
            400,
            f"Horario fuera del turno ({specialist['start_time']} - {specialist['end_time']})"
        )

    status_value = payload.status or "Confirmada"
    if status_value not in ALLOWED_STATUS:
        raise HTTPException(400, f"Estado inválido. Permitidos: {sorted(ALLOWED_STATUS)}")

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
                        f"Conflicto: ya existe una cita registrada de {a['start_time']} a {a['end_time']}"
                    )

        appt = Appointment(
            specialist_id=payload.specialist_id,
            service_id=service_id_value,
            client_name=payload.client_name.strip(),
            client_phone=(payload.client_phone or "").strip(),
            client_instagram=_normalize_handle(payload.client_instagram),
            client_tiktok=_normalize_handle(payload.client_tiktok),
            client_birthday=_normalize_birthday(payload.client_birthday),
            date=payload.date,
            start_time=payload.start_time,
            end_time=end_time_str,
            status=status_value,
            branch_id=specialist.get("branch_id"),
            is_overbooked=bool(payload.is_overbooked) or is_floating,
            is_floating=is_floating,
            custom_service_name=payload.custom_service_name if is_floating else None,
            custom_duration_minutes=duration if is_floating else None,
            receptionist_name=payload.receptionist_name,
            created_by=payload.created_by,
        )
        doc = appt.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.appointments.insert_one(doc)

    await _upsert_client(
        name=payload.client_name.strip(),
        phone=(payload.client_phone or "").strip(),
        instagram=appt.client_instagram,
        tiktok=appt.client_tiktok,
        birthday=appt.client_birthday,
    )

    return appt


@api_router.get("/appointments", response_model=List[Appointment])
async def list_appointments(date: Optional[str] = None, week_start: Optional[str] = None, branch_id: Optional[str] = None):
    q = {}
    if date:
        _validate_date(date)
        q["date"] = date
    elif week_start:
        _validate_date(week_start)
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
    
    if any(k in update for k in ["client_name", "client_phone", "client_instagram", "client_tiktok", "client_birthday"]):
        await _upsert_client(
            name=existing.get("client_name", ""),
            phone=existing.get("client_phone", ""),
            instagram=existing.get("client_instagram", ""),
            tiktok=existing.get("client_tiktok", ""),
            birthday=existing.get("client_birthday", ""),
        )

    return existing


@api_router.put("/appointments/{appt_id}", response_model=Appointment)
async def update_appointment_full(appt_id: str, data: dict):
    existing = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Cita no encontrada")

    data.pop("id", None)
    data.pop("_id", None)

    if "client_instagram" in data:
        data["client_instagram"] = _normalize_handle(data["client_instagram"])
    if "client_tiktok" in data:
        data["client_tiktok"] = _normalize_handle(data["client_tiktok"])

    await db.appointments.update_one({"id": appt_id}, {"$set": data})
    existing.update(data)

    await _upsert_client(
        name=existing.get("client_name", ""),
        phone=existing.get("client_phone", ""),
        instagram=existing.get("client_instagram", ""),
        tiktok=existing.get("client_tiktok", ""),
        birthday=existing.get("client_birthday", ""),
    )

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


@api_router.post("/appointments/{appt_id}/reschedule", response_model=Appointment)
async def reschedule_appointment(appt_id: str, payload: AppointmentReschedule):
    existing = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Cita no encontrada")

    _validate_date(payload.date)
    _validate_time(payload.start_time, "hora de inicio")

    new_specialist_id = payload.specialist_id or existing["specialist_id"]
    specialist = await db.specialists.find_one({"id": new_specialist_id}, {"_id": 0})
    if not specialist:
        cov = await db.coverages.find_one({
            "id": new_specialist_id,
            "start_date": {"$lte": payload.date},
            "end_date": {"$gte": payload.date}
        }, {"_id": 0})
        if cov:
            specialist = {
                "id": cov["id"],
                "name": cov.get("guest_name", "Invitado"),
                "specialty": cov.get("specialty", "Estilista"),
                "start_time": cov.get("start_time", "09:00"),
                "end_time": cov.get("end_time", "18:00"),
                "branch_id": cov.get("target_branch_id"),
            }
        else:
            raise HTTPException(400, "Especialista no encontrado")

    # Verificar si está de vacaciones
    vacation = await db.vacations.find_one({
        "specialist_id": new_specialist_id,
        "start_date": {"$lte": payload.date},
        "end_date": {"$gte": payload.date}
    }, {"_id": 0})
    if vacation:
        reason = vacation.get("reason") or "Vacaciones"
        raise HTTPException(400, f"{specialist.get('name', 'El especialista')} no está disponible el {payload.date} ({reason}).")

    _validate_time(specialist.get("start_time", ""), "turno especialista")
    _validate_time(specialist.get("end_time", ""), "turno especialista")

    old_start = time_to_minutes(existing["start_time"])
    old_end = time_to_minutes(existing["end_time"])
    duration = max(1, old_end - old_start)
    if existing.get("is_floating") and existing.get("custom_duration_minutes"):
        try:
            duration = int(existing["custom_duration_minutes"])
        except (TypeError, ValueError):
            pass

    new_start = time_to_minutes(payload.start_time)
    new_end = new_start + duration
    if new_end > DAY_MINUTES:
        raise HTTPException(400, "La cita se extiende más allá del día")
    new_end_time = minutes_to_time(new_end)

    sp_start = time_to_minutes(specialist["start_time"])
    sp_end = time_to_minutes(specialist["end_time"])
    if new_start < sp_start or end_min > sp_end:
        raise HTTPException(
            400,
            f"Horario fuera del turno ({specialist['start_time']} - {specialist['end_time']})"
        )

    skip_conflict = bool(existing.get("is_overbooked")) or bool(existing.get("is_floating"))
    lock = await _get_appt_lock(new_specialist_id, payload.date)
    async with lock:
        if not skip_conflict:
            existing_appts = await db.appointments.find(
                {
                    "specialist_id": new_specialist_id,
                    "date": payload.date,
                    "id": {"$ne": appt_id},
                    "is_overbooked": {"$ne": True},
                    "is_floating": {"$ne": True},
                },
                {"_id": 0},
            ).to_list(500)
            for a in existing_appts:
                a_start = time_to_minutes(a["start_time"])
                a_end = time_to_minutes(a["end_time"])
                if overlaps(new_start, new_end, a_start, a_end):
                    raise HTTPException(
                        409,
                        f"Conflicto: ya existe una cita registrada de {a['start_time']} a {a['end_time']}",
                    )

        await db.appointments.update_one(
            {"id": appt_id},
            {"$set": {
                "specialist_id": new_specialist_id,
                "branch_id": specialist.get("branch_id"),
                "date": payload.date,
                "start_time": payload.start_time,
                "end_time": new_end_time,
            }},
        )

    updated = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        try:
            updated["created_at"] = datetime.fromisoformat(updated["created_at"])
        except ValueError:
            updated["created_at"] = datetime.now(timezone.utc)
    return updated


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
    br_count = await db.branches.count_documents({})
    if br_count == 0:
        for b in SAMPLE_BRANCHES:
            br = Branch(**b)
            await db.branches.insert_one(br.model_dump())
    else:
        for b in SAMPLE_BRANCHES:
            canonical = b["name"]
            keyword = canonical.split("\u00b7")[-1].strip() if "\u00b7" in canonical else canonical.split()[-1]
            keyword_safe = re.escape(keyword)
            await db.branches.update_one(
                {
                    "$and": [
                        {
                            "$or": [
                                {"name": canonical},
                                {"name": {"$regex": keyword_safe, "$options": "i"}},
                            ]
                        },
                        {
                            "$or": [
                                {"pin": {"$exists": False}},
                                {"pin": None},
                                {"pin": ""},
                            ]
                        },
                    ]
                },
                {"$set": {"pin": b["pin"]}},
            )
            if keyword.lower() == "centro":
                await db.branches.update_many(
                    {"name": {"$regex": keyword_safe, "$options": "i"}},
                    {"$set": {"pin": "1111"}},
                )
    branches = await db.branches.find({}, {"_id": 0}).to_list(20)

    sp_count = await db.specialists.count_documents({})
    if sp_count == 0 and branches:
        for s in SAMPLE_SPECIALISTS:
            idx = s.pop("branch_index", 0)
            branch_id = branches[idx % len(branches)]["id"]
            sp = Specialist(branch_id=branch_id, **s)
            await db.specialists.insert_one(sp.model_dump())
    else:
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
        if branches:
            await db.specialists.update_many(
                {"$or": [{"branch_id": None}, {"branch_id": {"$exists": False}}]},
                {"$set": {"branch_id": branches[0]["id"]}}
            )

    sv_count = await db.services.count_documents({})
    if sv_count == 0:
        for s in SAMPLE_SERVICES:
            sv = Service(**s)
            await db.services.insert_one(sv.model_dump())

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
        await db.appointments.create_index([("specialist_id", 1), ("date", 1)])
        await db.appointments.create_index([("branch_id", 1), ("date", 1)])
        await db.appointments.create_index([("date", 1), ("start_time", 1)])
        await db.appointments.create_index("id", unique=True)
        await db.specialists.create_index("id", unique=True)
        await db.specialists.create_index("access_code")
        await db.receptionists.create_index("id", unique=True)
        await db.services.create_index("id", unique=True)
        await db.branches.create_index("id", unique=True)
        await db.clients.create_index("phone")
        await db.clients.create_index("name")
        await db.vacations.create_index([("specialist_id", 1), ("start_date", 1), ("end_date", 1)])
        await db.vacations.create_index([("branch_id", 1), ("start_date", 1), ("end_date", 1)])
        await db.vacations.create_index("id", unique=True)
        await db.coverages.create_index([("target_branch_id", 1), ("start_date", 1), ("end_date", 1)])
        await db.coverages.create_index("id", unique=True)
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
