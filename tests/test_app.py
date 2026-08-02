import json
import sqlite3
from datetime import date, timedelta

import app as app_module
from app import compute_streak


# ── compute_streak ────────────────────────────────────────────────────────────

def test_streak_empty():
    assert compute_streak({}) == 0


def test_streak_today_only():
    history = {date.today().isoformat(): {"completed": [1]}}
    assert compute_streak(history) == 1


def test_streak_three_consecutive_days():
    today = date.today()
    history = {
        today.isoformat():                      {"completed": [1]},
        (today - timedelta(days=1)).isoformat(): {"completed": [2]},
        (today - timedelta(days=2)).isoformat(): {"completed": [3]},
    }
    assert compute_streak(history) == 3


def test_streak_one_day_gap_allowed():
    today = date.today()
    history = {
        today.isoformat():                      {"completed": [1]},
        # yesterday missing — allowed skip
        (today - timedelta(days=2)).isoformat(): {"completed": [3]},
    }
    assert compute_streak(history) == 2


def test_streak_two_day_gap_breaks():
    today = date.today()
    history = {
        today.isoformat():                      {"completed": [1]},
        # yesterday and day-before missing
        (today - timedelta(days=3)).isoformat(): {"completed": [3]},
    }
    assert compute_streak(history) == 1


# ── Interviews ────────────────────────────────────────────────────────────────

def test_list_interviews_empty(client):
    res = client.get("/api/interviews")
    assert res.status_code == 200
    assert res.get_json() == []


def test_create_interview(client):
    payload = {"company_name": "Acme", "status": "Applied"}
    res = client.post("/api/interviews", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["company_name"] == "Acme"
    assert "id" in data
    assert data["application_date"] == date.today().isoformat()


def test_create_then_list_interview(client):
    client.post("/api/interviews", json={"company_name": "Acme"})
    res = client.get("/api/interviews")
    assert len(res.get_json()) == 1


def test_update_interview(client):
    created = client.post("/api/interviews", json={"company_name": "Acme"}).get_json()
    entry_id = created["id"]
    res = client.put(f"/api/interviews/{entry_id}", json={"company_name": "Globex", "status": "Offer"})
    assert res.status_code == 200
    assert res.get_json()["company_name"] == "Globex"


def test_update_interview_not_found(client):
    res = client.put("/api/interviews/nonexistent", json={"company_name": "X"})
    assert res.status_code == 404


def test_delete_interview(client):
    created = client.post("/api/interviews", json={"company_name": "Acme"}).get_json()
    entry_id = created["id"]
    res = client.delete(f"/api/interviews/{entry_id}")
    assert res.status_code == 204
    assert client.get("/api/interviews").get_json() == []


def test_delete_interview_not_found(client):
    res = client.delete("/api/interviews/nonexistent")
    assert res.status_code == 404


def test_create_interview_preserves_supplied_date(client):
    res = client.post("/api/interviews", json={"company_name": "X", "application_date": "2025-01-15"})
    assert res.get_json()["application_date"] == "2025-01-15"


# ── Behavioral practice ───────────────────────────────────────────────────────

def test_practice_today_returns_three_questions(client):
    res = client.get("/api/practice/today")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["questions"]) == 3
    assert data["completed"] == []
    assert data["streak"] == 0


def test_practice_today_deterministic(client):
    ids_first  = [q["id"] for q in client.get("/api/practice/today").get_json()["questions"]]
    ids_second = [q["id"] for q in client.get("/api/practice/today").get_json()["questions"]]
    assert ids_first == ids_second


def test_practice_complete_increments_streak(client):
    today_q = client.get("/api/practice/today").get_json()
    qid = today_q["questions"][0]["id"]
    res = client.post("/api/practice/complete", json={"question_id": qid})
    assert res.status_code == 200
    assert res.get_json()["streak"] == 1


def test_practice_complete_idempotent(client):
    qid = client.get("/api/practice/today").get_json()["questions"][0]["id"]
    client.post("/api/practice/complete", json={"question_id": qid})
    client.post("/api/practice/complete", json={"question_id": qid})
    practice = app_module.load_practice()
    today = date.today().isoformat()
    assert practice["history"][today]["completed"].count(qid) == 1


def test_practice_progress_has_seven_days(client):
    res = client.get("/api/practice/progress")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["calendar"]) == 7
    assert "streak" in data
    assert "total_completed" in data


# ── Combined progress ─────────────────────────────────────────────────────────

def test_combined_progress_shape(client):
    res = client.get("/api/progress")
    assert res.status_code == 200
    data = res.get_json()
    for key in ("streak", "rq_streak", "total_questions", "total_rq",
                "total_sd", "sd_this_week", "challenges_done", "challenges_total", "calendar"):
        assert key in data
    assert len(data["calendar"]) == 7


def test_combined_progress_calendar_has_rq_count(client):
    data = client.get("/api/progress").get_json()
    assert all("rq_count" in day for day in data["calendar"])


# ── Challenges ────────────────────────────────────────────────────────────────

def test_list_challenges_has_done_field(client):
    res = client.get("/api/challenges")
    assert res.status_code == 200
    challenges = res.get_json()
    assert len(challenges) > 0
    assert all("done" in c for c in challenges)
    assert all(c["done"] is False for c in challenges)


def test_toggle_challenge_on(client):
    challenge_id = client.get("/api/challenges").get_json()[0]["id"]
    res = client.post("/api/challenges/toggle", json={"id": challenge_id})
    assert res.status_code == 200
    data = res.get_json()
    assert data["done"] is True
    assert data["total_done"] == 1


def test_toggle_challenge_off(client):
    challenge_id = client.get("/api/challenges").get_json()[0]["id"]
    client.post("/api/challenges/toggle", json={"id": challenge_id})
    res = client.post("/api/challenges/toggle", json={"id": challenge_id})
    data = res.get_json()
    assert data["done"] is False
    assert data["total_done"] == 0


def test_toggle_challenge_reflected_in_list(client):
    challenge_id = client.get("/api/challenges").get_json()[0]["id"]
    client.post("/api/challenges/toggle", json={"id": challenge_id})
    toggled = next(c for c in client.get("/api/challenges").get_json() if c["id"] == challenge_id)
    assert toggled["done"] is True


# ── Recruiter practice ────────────────────────────────────────────────────────

def test_recruiter_today_returns_five_questions(client):
    res = client.get("/api/recruiter/today")
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["questions"]) == 5
    assert data["completed"] == []
    assert data["streak"] == 0


def test_recruiter_today_deterministic(client):
    ids_first  = [q["id"] for q in client.get("/api/recruiter/today").get_json()["questions"]]
    ids_second = [q["id"] for q in client.get("/api/recruiter/today").get_json()["questions"]]
    assert ids_first == ids_second


def test_recruiter_complete_increments_streak(client):
    qid = client.get("/api/recruiter/today").get_json()["questions"][0]["id"]
    res = client.post("/api/recruiter/complete", json={"question_id": qid})
    assert res.status_code == 200
    assert res.get_json()["streak"] == 1


def test_recruiter_reset_clears_completed(client):
    qid = client.get("/api/recruiter/today").get_json()["questions"][0]["id"]
    client.post("/api/recruiter/complete", json={"question_id": qid})
    res = client.post("/api/recruiter/reset")
    assert res.status_code == 200
    practice = app_module.load_recruiter_practice()
    today = date.today().isoformat()
    assert practice["history"][today]["completed"] == []


# ── System design ─────────────────────────────────────────────────────────────

def test_list_system_design_empty(client):
    res = client.get("/api/system-design")
    assert res.status_code == 200
    assert res.get_json() == []


def test_create_system_design(client):
    res = client.post("/api/system-design", json={"problem": "Design Twitter"})
    assert res.status_code == 201
    data = res.get_json()
    assert data["problem"] == "Design Twitter"
    assert "id" in data
    assert data["date"] == date.today().isoformat()


def test_create_system_design_preserves_date(client):
    res = client.post("/api/system-design", json={"problem": "URL Shortener", "date": "2025-03-01"})
    assert res.get_json()["date"] == "2025-03-01"


def test_update_system_design(client):
    created = client.post("/api/system-design", json={"problem": "Design Twitter"}).get_json()
    entry_id = created["id"]
    res = client.put(f"/api/system-design/{entry_id}", json={"problem": "Design Uber", "score": 4})
    assert res.status_code == 200
    assert res.get_json()["problem"] == "Design Uber"


def test_update_system_design_not_found(client):
    res = client.put("/api/system-design/nonexistent", json={"problem": "X"})
    assert res.status_code == 404


def test_delete_system_design(client):
    created = client.post("/api/system-design", json={"problem": "Design Twitter"}).get_json()
    entry_id = created["id"]
    res = client.delete(f"/api/system-design/{entry_id}")
    assert res.status_code == 204
    assert client.get("/api/system-design").get_json() == []


def test_delete_system_design_not_found(client):
    res = client.delete("/api/system-design/nonexistent")
    assert res.status_code == 404


# ── Challenges progress migration ─────────────────────────────────────────────

def test_challenges_progress_migrates_list_format(tmp_data):
    legacy = {"completed": [1, 2, 3]}
    (tmp_data / "challenges_progress.json").write_text(json.dumps(legacy))
    data = app_module.load_challenges_progress()
    assert isinstance(data["completed"], dict)
    assert set(data["completed"].keys()) == {"1", "2", "3"}


def test_legacy_interviews_are_imported_once(tmp_data):
    legacy_file = tmp_data / "interviews.json"
    legacy_file.write_text(json.dumps([{"id": "1", "company_name": "Acme"}]))

    assert app_module.load_data()[0]["company_name"] == "Acme"

    legacy_file.write_text(json.dumps([]))
    assert app_module.load_data()[0]["company_name"] == "Acme"


def test_data_is_saved_in_sqlite(tmp_data):
    app_module.save_data([{"id": "1", "company_name": "Acme"}])

    with sqlite3.connect(tmp_data / "tracker.db") as connection:
        row = connection.execute(
            "SELECT value FROM app_state WHERE key = 'interviews'"
        ).fetchone()

    assert json.loads(row[0]) == [{"id": "1", "company_name": "Acme"}]
