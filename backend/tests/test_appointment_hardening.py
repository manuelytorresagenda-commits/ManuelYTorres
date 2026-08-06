"""Hardening tests for /api/appointments scheduling robustness.

Covers:
- Input validation (time/date/duration/status/empty client/end>24:00)
- PATCH status validation
- Conflict detection (regular vs regular = 409)
- Race condition: 5 concurrent regulars on same slot -> only 1 succeeds
- Extras/floating bypass conflict checks (always accepted)
- Stable list ordering (date, start_time, created_at)
- Render fix scenario: primary 10:00-10:45 + extra 10:30 both present in API
"""
import os
import asyncio
import uuid
import pytest
import aiohttp
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
def centro(s):
    branches = s.get(f"{API}/branches").json()
    return next(b for b in branches if "Centro" in b["name"])


@pytest.fixture(scope="module")
def sofia(s, centro):
    sps = s.get(f"{API}/specialists", params={"branch_id": centro["id"]}).json()
    return next(x for x in sps if x["name"] == "Sofía Vargas")


@pytest.fixture(scope="module")
def service_45(s, centro):
    svcs = s.get(f"{API}/services", params={"branch_id": centro["id"]}).json()
    return next(x for x in svcs if x["duration_minutes"] == 45)


def _future_date(days=20):
    # Use a unique-ish day per test to avoid cross-test interference.
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


# ----------------- INPUT VALIDATION -----------------
@pytest.mark.parametrize("bad_time", ["25:00", "10:5", "abc", "", "10-30"])
def test_invalid_start_time_400(s, sofia, service_45, bad_time):
    payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_BadTime",
        "date": _future_date(21),
        "start_time": bad_time,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400, f"expected 400 for {bad_time!r}, got {r.status_code}: {r.text}"


@pytest.mark.parametrize("bad_date", ["2026/05/10", "10-05-2026", "2026-13-01", "abcd", ""])
def test_invalid_date_400(s, sofia, service_45, bad_date):
    payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_BadDate",
        "date": bad_date,
        "start_time": "10:00",
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400, f"expected 400 for {bad_date!r}, got {r.status_code}: {r.text}"


@pytest.mark.parametrize("bad_dur", [0, -10, 1441, 99999])
def test_invalid_floating_duration_400(s, sofia, bad_dur):
    payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_BadDur",
        "date": _future_date(22),
        "start_time": "10:00",
        "is_floating": True,
        "custom_service_name": "X",
        "custom_duration_minutes": bad_dur,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400, f"expected 400 for dur={bad_dur}, got {r.status_code}"


def test_invalid_status_create_400(s, sofia, service_45):
    payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "TEST_BadStatus",
        "date": _future_date(23),
        "start_time": "10:00",
        "status": "Cancelada",
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400


def test_empty_client_name_400(s, sofia, service_45):
    payload = {
        "specialist_id": sofia["id"],
        "service_id": service_45["id"],
        "client_name": "   ",
        "date": _future_date(24),
        "start_time": "10:00",
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400


def test_end_time_overflow_day_400(s, sofia):
    # Floating appt at 23:30 with 60 min => 24:30 -> must fail
    payload = {
        "specialist_id": sofia["id"],
        "client_name": "TEST_Overflow",
        "date": _future_date(25),
        "start_time": "23:30",
        "is_floating": True,
        "custom_service_name": "Largo",
        "custom_duration_minutes": 60,
    }
    r = s.post(f"{API}/appointments", json=payload)
    assert r.status_code == 400


# ----------------- PATCH STATUS -----------------
def test_patch_status_invalid_400(s, sofia, service_45):
    d = _future_date(26)
    create = s.post(f"{API}/appointments", json={
        "specialist_id": sofia["id"], "service_id": service_45["id"],
        "client_name": "TEST_Patch", "date": d, "start_time": "12:00",
    })
    assert create.status_code == 200, create.text
    aid = create.json()["id"]
    try:
        for bad in ["Cancelada", "Pendiente", "foo", ""]:
            r = s.patch(f"{API}/appointments/{aid}", json={"status": bad})
            assert r.status_code == 400, f"status {bad!r} should 400, got {r.status_code}"
        # valid one
        ok = s.patch(f"{API}/appointments/{aid}", json={"status": "En curso"})
        assert ok.status_code == 200
        assert ok.json()["status"] == "En curso"
    finally:
        s.delete(f"{API}/appointments/{aid}")


# ----------------- CONFLICT DETECTION -----------------
def test_two_regulars_overlap_409(s, sofia, service_45):
    d = _future_date(27)
    p1 = {"specialist_id": sofia["id"], "service_id": service_45["id"],
          "client_name": "TEST_Reg1", "date": d, "start_time": "13:00"}
    r1 = s.post(f"{API}/appointments", json=p1)
    assert r1.status_code == 200, r1.text
    aid1 = r1.json()["id"]
    try:
        p2 = {"specialist_id": sofia["id"], "service_id": service_45["id"],
              "client_name": "TEST_Reg2", "date": d, "start_time": "13:30"}
        r2 = s.post(f"{API}/appointments", json=p2)
        assert r2.status_code == 409, r2.text
    finally:
        s.delete(f"{API}/appointments/{aid1}")


def test_regular_can_be_created_when_only_extras_present(s, sofia, service_45):
    """A regular appointment must be creatable in an empty slot even if extras exist on top of OTHER hours."""
    d = _future_date(28)
    # Create overbooked extra at 10:30
    extra = s.post(f"{API}/appointments", json={
        "specialist_id": sofia["id"], "service_id": service_45["id"],
        "client_name": "TEST_Extra", "date": d, "start_time": "10:30",
        "is_overbooked": True,
    })
    assert extra.status_code == 200, extra.text
    eid = extra.json()["id"]
    try:
        # Create a regular at 14:00 - no overlap with extras OR primaries -> must succeed
        reg = s.post(f"{API}/appointments", json={
            "specialist_id": sofia["id"], "service_id": service_45["id"],
            "client_name": "TEST_RegFree", "date": d, "start_time": "14:00",
        })
        assert reg.status_code == 200, reg.text
        s.delete(f"{API}/appointments/{reg.json()['id']}")
    finally:
        s.delete(f"{API}/appointments/{eid}")


# ----------------- RACE CONDITION -----------------
@pytest.mark.asyncio
async def test_race_condition_only_one_wins(sofia, service_45):
    """Fire 5 concurrent regular requests on same slot - only one should succeed (200), rest 409."""
    d = _future_date(29)
    payload = {
        "specialist_id": sofia["id"], "service_id": service_45["id"],
        "client_name": "TEST_Race", "date": d, "start_time": "15:00",
    }

    async def post_one(session):
        async with session.post(f"{API}/appointments", json=payload) as r:
            data = await r.json()
            return r.status, data

    async with aiohttp.ClientSession(headers={"Content-Type": "application/json"}) as session:
        results = await asyncio.gather(*[post_one(session) for _ in range(5)])

    statuses = [s for s, _ in results]
    successes = [d for s, d in results if s == 200]
    conflicts = [s for s in statuses if s == 409]

    print("Race statuses:", statuses)
    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {statuses}"
    assert len(conflicts) == 4, f"Expected 4 conflicts, got {len(conflicts)}: {statuses}"

    # cleanup using sync requests
    requests.delete(f"{API}/appointments/{successes[0]['id']}")


# ----------------- EXTRAS / FLOATING IGNORE EACH OTHER -----------------
def test_render_scenario_primary_plus_extra_both_listed(s, sofia, service_45):
    d = _future_date(30)
    primary = s.post(f"{API}/appointments", json={
        "specialist_id": sofia["id"], "service_id": service_45["id"],
        "client_name": "TEST_Primary", "date": d, "start_time": "10:00",
    })
    assert primary.status_code == 200, primary.text
    pid = primary.json()["id"]
    assert primary.json()["end_time"] == "10:45"
    try:
        extra = s.post(f"{API}/appointments", json={
            "specialist_id": sofia["id"], "service_id": service_45["id"],
            "client_name": "TEST_ExtraInside", "date": d, "start_time": "10:30",
            "is_overbooked": True,
        })
        assert extra.status_code == 200, extra.text
        eid = extra.json()["id"]
        try:
            # Floating overlapping at 10:15
            floa = s.post(f"{API}/appointments", json={
                "specialist_id": sofia["id"],
                "client_name": "TEST_FloatInside", "date": d, "start_time": "10:15",
                "is_floating": True,
                "custom_service_name": "Express",
                "custom_duration_minutes": 30,
            })
            assert floa.status_code == 200, floa.text
            fid = floa.json()["id"]
            try:
                # GET should return all 3
                listing = s.get(f"{API}/appointments", params={"date": d}).json()
                ids = {a["id"] for a in listing}
                assert pid in ids and eid in ids and fid in ids, f"Missing: ids={ids}"
            finally:
                s.delete(f"{API}/appointments/{fid}")
        finally:
            s.delete(f"{API}/appointments/{eid}")
    finally:
        s.delete(f"{API}/appointments/{pid}")


# ----------------- STABLE ORDERING -----------------
def test_stable_ordering_by_created_at(s, sofia, service_45):
    d = _future_date(31)
    ids_in_order = []
    try:
        for i in range(3):
            r = s.post(f"{API}/appointments", json={
                "specialist_id": sofia["id"], "service_id": service_45["id"],
                "client_name": f"TEST_Order{i}", "date": d, "start_time": "16:00",
                "is_overbooked": True,
            })
            assert r.status_code == 200, r.text
            ids_in_order.append(r.json()["id"])

        listing = s.get(f"{API}/appointments", params={"date": d}).json()
        # Filter to those at 16:00 we created
        ours = [a for a in listing if a["id"] in ids_in_order]
        # API ordering should match insertion (by created_at)
        api_ids = [a["id"] for a in ours]
        assert api_ids == ids_in_order, f"Order mismatch: api={api_ids} vs created={ids_in_order}"
    finally:
        for aid in ids_in_order:
            s.delete(f"{API}/appointments/{aid}")
