"""Backend API tests for Salon Manuel & Torres - floating appointments + client_phone."""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def branches(s):
    r = s.get(f"{API}/branches")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def centro(branches):
    return next(b for b in branches if "Centro" in b["name"])


@pytest.fixture(scope="module")
def sofia(s, centro):
    sp_centro = s.get(f"{API}/specialists", params={"branch_id": centro["id"]}).json()
    return next(x for x in sp_centro if x["name"] == "Sofía Vargas")


@pytest.fixture(scope="module")
def service_45(s):
    svcs = s.get(f"{API}/services").json()
    # corte de cabello 45min
    return next(x for x in svcs if x["duration_minutes"] == 45)


# ---------- AUTH ----------
def test_pin_correct_0000(s):
    r = s.post(f"{API}/auth/verify-pin", json={"pin": "0000"})
    assert r.status_code == 200
    assert r.json().get("success") is True


def test_pin_wrong(s):
    r = s.post(f"{API}/auth/verify-pin", json={"pin": "9999"})
    assert r.status_code == 401


# ---------- APPOINTMENT: client_phone field ----------
def test_create_appointment_with_client_phone(s, sofia, service_45):
    d = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_ClientePhone",
        "client_phone": "5551234567",
        "date": d,
        "start_time": "09:00",
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 200, r.text
    appt = r.json()
    assert appt["client_phone"] == "5551234567"
    assert appt["is_floating"] is False
    assert appt["is_overbooked"] is False

    # GET verify persistence
    g = s.get(f"{API}/appointments", params={"date": d, "branch_id": appt["branch_id"]}).json()
    found = next((a for a in g if a["id"] == appt["id"]), None)
    assert found is not None
    assert found["client_phone"] == "5551234567"

    # Cleanup
    s.delete(f"{API}/appointments/{appt['id']}")


# ---------- FLOATING APPOINTMENTS ----------
def test_create_floating_appointment_success(s, sofia):
    d = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
    payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_Flotante",
        "client_phone": "5559999",
        "date": d,
        "start_time": "10:00",
        "is_floating": True,
        "custom_service_name": "Cejas rápidas",
        "custom_duration_minutes": 30,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 200, r.text
    appt = r.json()
    assert appt["is_floating"] is True
    assert appt["is_overbooked"] is True, "floating must auto-mark as overbooked"
    assert appt["custom_service_name"] == "Cejas rápidas"
    assert appt["custom_duration_minutes"] == 30
    assert appt["end_time"] == "10:30"
    assert appt["service_id"] == ""
    s.delete(f"{API}/appointments/{appt['id']}")


def test_create_floating_missing_fields_400(s, sofia):
    d = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
    # Missing custom_service_name
    payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_F1",
        "date": d,
        "start_time": "10:00",
        "is_floating": True,
        "custom_duration_minutes": 30,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400

    # Missing custom_duration_minutes
    payload2 = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_F2",
        "date": d,
        "start_time": "10:00",
        "is_floating": True,
        "custom_service_name": "Rápido",
    }
    r2 = s.post(f"{API}/appointments", json=payload2)
    assert r2.status_code == 400


def test_floating_skips_conflict(s, sofia, service_45):
    """Create a regular appointment, then a floating that overlaps -> must succeed."""
    d = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")

    # 1) Regular cita 10:00-10:45 (service_45 = 45 min)
    reg_payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_Regular",
        "date": d,
        "start_time": "10:00",
    }
    r = s.post(f"{API}/appointments", json=reg_payload)
    assert r.status_code == 200, r.text
    reg_id = r.json()["id"]

    # 2) Flotante 10:30 (overlaps) with is_floating=True => should succeed
    float_payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_Flotante_Overlap",
        "date": d,
        "start_time": "10:30",
        "is_floating": True,
        "custom_service_name": "Retoque",
        "custom_duration_minutes": 30,
    }
    rf = s.post(f"{API}/appointments", json=float_payload)
    assert rf.status_code == 200, rf.text
    flo_id = rf.json()["id"]
    assert rf.json()["is_floating"] is True

    # 3) A second REGULAR cita at 10:30 (overlapping) WITHOUT is_overbooked => 409
    conflict_payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_Conflict",
        "date": d,
        "start_time": "10:30",
    }
    rc = s.post(f"{API}/appointments", json=conflict_payload)
    assert rc.status_code == 409, f"Regular overlapping should conflict, got {rc.status_code}: {rc.text}"

    # Cleanup
    s.delete(f"{API}/appointments/{reg_id}")
    s.delete(f"{API}/appointments/{flo_id}")


def test_list_appointments_returns_floating_flag(s, sofia):
    d = (datetime.now() + timedelta(days=11)).strftime("%Y-%m-%d")
    payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_ListFlotante",
        "date": d,
        "start_time": "11:00",
        "is_floating": True,
        "custom_service_name": "Corte express",
        "custom_duration_minutes": 45,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 200
    aid = r.json()["id"]

    g = s.get(f"{API}/appointments", params={"date": d}).json()
    found = next((a for a in g if a["id"] == aid), None)
    assert found is not None
    assert found["is_floating"] is True
    assert found["custom_service_name"] == "Corte express"
    assert found["custom_duration_minutes"] == 45
    assert found["end_time"] == "11:45"
    s.delete(f"{API}/appointments/{aid}")
