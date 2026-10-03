import json
import os
import random as _random
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

from flask import Flask, jsonify, render_template, request

from storage import load_state, save_state

app = Flask(__name__)

# LinkedIn shows "No longer accepting applications" logged out and
# "Not currently accepting applications" logged in; either means closed.
CLOSED_JOB_MARKERS = (
    "closed-job__flavor--closed",
    "No longer accepting applications",
    "Not currently accepting applications",
)
# Jobs you haven't acted on yet: only these get auto-discarded or auto-closed.
UNTOUCHED_JOB_STATUSES = ("Pending", "Interested")


def check_job_link_closed(url):
    """Return True if the LinkedIn job posting at url is closed (no longer accepting applications),
    False if it looks open, or None if it couldn't be checked."""
    if not url.lower().startswith(("http://", "https://")):
        return None
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310 - scheme checked above
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310 - scheme checked above
            html = resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, OSError, ValueError):
        return None
    return any(marker in html for marker in CLOSED_JOB_MARKERS)


DATABASE_FILE = os.path.join(os.path.dirname(__file__), "data", "tracker.db")
QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "data", "questions.json")
PRACTICE_FILE = os.path.join(os.path.dirname(__file__), "data", "practice.json")
SYSTEM_DESIGN_FILE = os.path.join(os.path.dirname(__file__), "data", "system_design.json")
CHALLENGES_FILE = os.path.join(os.path.dirname(__file__), "data", "challenges.json")
CHALLENGES_PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "data", "challenges_progress.json")
RECRUITER_QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "data", "recruiter_questions.json")
RECRUITER_PRACTICE_FILE = os.path.join(os.path.dirname(__file__), "data", "recruiter_practice.json")
COMPANIES_FILE = os.path.join(os.path.dirname(__file__), "data", "companies.json")
JOBS_FILE = os.path.join(os.path.dirname(__file__), "data", "jobs.json")
GLASSDOOR_CACHE_FILE = os.path.join(os.path.dirname(__file__), "data", "glassdoor_cache.json")
SEARCH_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "job-search.json")
SEARCH_CONFIG_EXAMPLE_FILE = os.path.join(os.path.dirname(__file__), "job-search.example.json")


def load_questions():
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


def load_practice():
    return load_state(DATABASE_FILE, "practice", {"history": {}}, PRACTICE_FILE)


def save_practice(data):
    save_state(DATABASE_FILE, "practice", data)


def load_system_design():
    return load_state(DATABASE_FILE, "system_design", {"exercises": []}, SYSTEM_DESIGN_FILE)


def save_system_design(data):
    save_state(DATABASE_FILE, "system_design", data)


def load_challenges():
    with open(CHALLENGES_FILE) as f:
        return json.load(f)


def load_challenges_progress():
    data = load_state(
        DATABASE_FILE,
        "challenges_progress",
        {"completed": {}},
        CHALLENGES_PROGRESS_FILE,
    )
    # migrate old list format → {id: date} dict
    if isinstance(data.get("completed"), list):
        data["completed"] = {str(i): date.today().isoformat() for i in data["completed"]}
        save_challenges_progress(data)
    return data


def save_challenges_progress(data):
    save_state(DATABASE_FILE, "challenges_progress", data)


def load_recruiter_questions():
    with open(RECRUITER_QUESTIONS_FILE) as f:
        return json.load(f)


def load_recruiter_practice():
    return load_state(
        DATABASE_FILE,
        "recruiter_practice",
        {"history": {}},
        RECRUITER_PRACTICE_FILE,
    )


def save_recruiter_practice(data):
    save_state(DATABASE_FILE, "recruiter_practice", data)


def load_companies():
    return load_state(DATABASE_FILE, "companies", {"companies": []}, COMPANIES_FILE)


def save_companies(data):
    save_state(DATABASE_FILE, "companies", data)


def load_jobs():
    return load_state(DATABASE_FILE, "jobs", {"jobs": []}, JOBS_FILE)


def save_jobs(data):
    save_state(DATABASE_FILE, "jobs", data)


def load_glassdoor_cache():
    return load_state(DATABASE_FILE, "glassdoor_cache", {}, GLASSDOOR_CACHE_FILE)


def save_glassdoor_cache(data):
    save_state(DATABASE_FILE, "glassdoor_cache", data)


def sync_glassdoor_cache(entry):
    """Fill entry's glassdoor fields from the cache if it omits them, or
    update the cache when entry supplies a rating. Glassdoor ratings rarely
    change, so once a company is looked up it never needs re-scraping."""
    company_key = (entry.get("company") or "").strip().lower()
    if not company_key:
        return
    cache = load_glassdoor_cache()
    if entry.get("glassdoor_rating") not in (None, ""):
        cache[company_key] = {
            "glassdoor_rating": entry.get("glassdoor_rating"),
            "glassdoor_notes": entry.get("glassdoor_notes", ""),
            "updated_at": date.today().isoformat(),
        }
        save_glassdoor_cache(cache)
    elif company_key in cache:
        entry["glassdoor_rating"] = cache[company_key].get("glassdoor_rating")
        entry["glassdoor_notes"] = cache[company_key].get("glassdoor_notes", "")


def ensure_company_exists(entry):
    """Make sure every company seen in the Jobs tab also has a Companies
    entry, so Companies stays the one place with every company you've come
    across plus its reputation (via the glassdoor cache). Never overwrites
    an existing company's fields."""
    company_name = (entry.get("company") or "").strip()
    if not company_name:
        return
    company_key = company_name.lower()
    data = load_companies()
    if any((c.get("company_name") or "").strip().lower() == company_key for c in data["companies"]):
        return
    data["companies"].append(
        {
            "id": str(uuid.uuid4()),
            "company_name": company_name,
            "url": "",
            "industry": "",
            "location": entry.get("location", ""),
            "interest_level": None,
            "benefits": "",
            "notes": "",
        }
    )
    save_companies(data)


def normalize_company(name):
    return (name or "").strip().lower()


def is_company_excluded(name):
    key = normalize_company(name)
    return bool(key) and any(
        c.get("excluded") and normalize_company(c.get("company_name")) == key for c in load_companies()["companies"]
    )


def discard_company_jobs(name):
    """Mark every untouched job at this company as Discarded. Jobs you've
    already applied to or are interviewing for are left alone. Returns how
    many jobs were discarded."""
    key = normalize_company(name)
    data = load_jobs()
    discarded = 0
    for entry in data["jobs"]:
        if normalize_company(entry.get("company")) != key:
            continue
        if entry.get("status", "Pending") not in UNTOUCHED_JOB_STATUSES:
            continue
        history = entry.get("status_history") or backfill_status_history(entry)
        entry["status"] = "Discarded"
        record_status(entry, history)
        discarded += 1
    if discarded:
        save_jobs(data)
    return discarded


def migrate_company_contacts():
    """Contacts used to live on companies; they now live on jobs. Copy any
    company contacts onto every job at that company (unless the job already
    has its own), then drop them from the company so this only runs once."""
    companies = load_companies()
    if not any("contacts" in c for c in companies["companies"]):
        return
    by_company = {}
    for c in companies["companies"]:
        named = [p for p in c.pop("contacts", None) or [] if (p.get("name") or "").strip()]
        if named:
            by_company[(c.get("company_name") or "").strip().lower()] = named
    jobs = load_jobs()
    for entry in jobs["jobs"]:
        contacts = by_company.get((entry.get("company") or "").strip().lower())
        if contacts and not entry.get("contacts"):
            entry["contacts"] = [dict(p) for p in contacts]
    save_jobs(jobs)
    save_companies(companies)


def backfill_status_history(entry):
    """Best-guess history for jobs saved before history was recorded: every
    listing starts as Pending, and any later status is dated to when it was added."""
    added = entry.get("date_added") or date.today().isoformat()
    history = [{"status": "Pending", "date": added}]
    status = entry.get("status")
    if status and status != "Pending":
        history.append({"status": status, "date": added})
    return history


def record_status(entry, history):
    """Store history on entry, appending the current status if it changed."""
    status = entry.get("status") or "Pending"
    if not history or history[-1]["status"] != status:
        history = history + [{"status": status, "date": date.today().isoformat()}]
    entry["status_history"] = history


def compute_streak(history):
    today = date.today()
    streak = 0
    d = today
    skipped_today = False
    while streak <= 365:
        key = d.isoformat()
        completed = history.get(key, {}).get("completed", [])
        if completed:
            streak += 1
            d -= timedelta(days=1)
        elif not skipped_today:
            skipped_today = True
            d -= timedelta(days=1)
        else:
            break
    return streak


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/practice/today", methods=["GET"])
def practice_today():
    questions = load_questions()
    practice = load_practice()
    today = date.today().isoformat()

    rng = _random.Random(int(date.today().strftime("%Y%m%d")))  # noqa: S311 - picks practice questions, not security
    all_ids = [q["id"] for q in questions]
    selected_ids = rng.sample(all_ids, 3)

    if today not in practice["history"]:
        practice["history"][today] = {"questions": selected_ids, "completed": []}
        save_practice(practice)
    else:
        selected_ids = practice["history"][today].get("questions", selected_ids)

    q_map = {q["id"]: q for q in questions}
    selected_questions = [q_map[qid] for qid in selected_ids if qid in q_map]
    completed = practice["history"][today].get("completed", [])

    return jsonify(
        {
            "questions": selected_questions,
            "completed": completed,
            "streak": compute_streak(practice["history"]),
        }
    )


@app.route("/api/practice/complete", methods=["POST"])
def practice_complete():
    body = request.get_json()
    question_id = body["question_id"]
    practice = load_practice()
    today = date.today().isoformat()

    if today not in practice["history"]:
        practice["history"][today] = {"questions": [], "completed": []}

    if question_id not in practice["history"][today]["completed"]:
        practice["history"][today]["completed"].append(question_id)

    save_practice(practice)
    return jsonify({"streak": compute_streak(practice["history"])})


@app.route("/api/practice/progress", methods=["GET"])
def practice_progress():
    practice = load_practice()
    today = date.today()

    calendar = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        key = d.isoformat()
        day_data = practice["history"].get(key, {})
        calendar.append(
            {
                "date": key,
                "completed": len(day_data.get("completed", [])),
                "total": len(day_data.get("questions", [])) or 3,
            }
        )

    total_completed = sum(len(v.get("completed", [])) for v in practice["history"].values())
    return jsonify(
        {
            "calendar": calendar,
            "streak": compute_streak(practice["history"]),
            "total_completed": total_completed,
        }
    )


@app.route("/api/progress", methods=["GET"])
def combined_progress():
    practice = load_practice()
    sd_data = load_system_design()
    ch_progress = load_challenges_progress()
    rq_practice = load_recruiter_practice()
    today = date.today()

    calendar = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        key = d.isoformat()
        day_data = practice["history"].get(key, {})
        sd_count = sum(1 for e in sd_data["exercises"] if e.get("date") == key)
        ch_count = sum(1 for v in ch_progress["completed"].values() if v == key)
        rq_count = len(rq_practice["history"].get(key, {}).get("completed", []))
        calendar.append(
            {
                "date": key,
                "questions_completed": len(day_data.get("completed", [])),
                "questions_total": len(day_data.get("questions", [])) or 3,
                "sd_count": sd_count,
                "ch_count": ch_count,
                "rq_count": rq_count,
            }
        )

    total_questions = sum(len(v.get("completed", [])) for v in practice["history"].values())
    total_rq = sum(len(v.get("completed", [])) for v in rq_practice["history"].values())
    week_ago = today - timedelta(days=7)
    sd_this_week = sum(1 for e in sd_data["exercises"] if e.get("date") and date.fromisoformat(e["date"]) >= week_ago)

    challenges_done = len(ch_progress["completed"])
    challenges_total = len(load_challenges())

    return jsonify(
        {
            "streak": compute_streak(practice["history"]),
            "rq_streak": compute_streak(rq_practice["history"]),
            "total_questions": total_questions,
            "total_rq": total_rq,
            "total_sd": len(sd_data["exercises"]),
            "sd_this_week": sd_this_week,
            "challenges_done": challenges_done,
            "challenges_total": challenges_total,
            "calendar": calendar,
        }
    )


@app.route("/api/challenges", methods=["GET"])
def list_challenges():
    challenges = load_challenges()
    progress = load_challenges_progress()
    completed = progress["completed"]
    for c in challenges:
        c["done"] = str(c["id"]) in completed
    return jsonify(challenges)


@app.route("/api/challenges/toggle", methods=["POST"])
def toggle_challenge():
    body = request.get_json()
    challenge_id = str(body["id"])
    progress = load_challenges_progress()
    completed = progress["completed"]
    if challenge_id in completed:
        del completed[challenge_id]
        done = False
    else:
        completed[challenge_id] = date.today().isoformat()
        done = True
    save_challenges_progress(progress)
    return jsonify({"done": done, "total_done": len(completed)})


@app.route("/api/recruiter/today", methods=["GET"])
def recruiter_today():
    questions = load_recruiter_questions()
    practice = load_recruiter_practice()
    today = date.today().isoformat()

    rng = _random.Random(int(date.today().strftime("%Y%m%d")) + 1)  # noqa: S311 - picks practice questions, not security
    all_ids = [q["id"] for q in questions]
    selected_ids = rng.sample(all_ids, 5)

    if today not in practice["history"]:
        practice["history"][today] = {"questions": selected_ids, "completed": []}
        save_recruiter_practice(practice)
    else:
        selected_ids = practice["history"][today].get("questions", selected_ids)

    q_map = {q["id"]: q for q in questions}
    selected_questions = [q_map[qid] for qid in selected_ids if qid in q_map]
    completed = practice["history"][today].get("completed", [])

    return jsonify(
        {
            "questions": selected_questions,
            "completed": completed,
            "streak": compute_streak(practice["history"]),
        }
    )


@app.route("/api/recruiter/complete", methods=["POST"])
def recruiter_complete():
    body = request.get_json()
    question_id = body["question_id"]
    practice = load_recruiter_practice()
    today = date.today().isoformat()

    if today not in practice["history"]:
        practice["history"][today] = {"questions": [], "completed": []}

    if question_id not in practice["history"][today]["completed"]:
        practice["history"][today]["completed"].append(question_id)

    save_recruiter_practice(practice)
    return jsonify({"streak": compute_streak(practice["history"])})


@app.route("/api/recruiter/reset", methods=["POST"])
def recruiter_reset():
    practice = load_recruiter_practice()
    today = date.today().isoformat()
    if today in practice["history"]:
        practice["history"][today]["completed"] = []
    save_recruiter_practice(practice)
    return jsonify({"streak": compute_streak(practice["history"])})


@app.route("/api/system-design", methods=["GET"])
def list_system_design():
    return jsonify(load_system_design()["exercises"])


@app.route("/api/system-design", methods=["POST"])
def create_system_design():
    data = load_system_design()
    entry = request.get_json()
    entry["id"] = str(uuid.uuid4())
    if not entry.get("date"):
        entry["date"] = date.today().isoformat()
    data["exercises"].append(entry)
    save_system_design(data)
    return jsonify(entry), 201


@app.route("/api/system-design/<entry_id>", methods=["PUT"])
def update_system_design(entry_id):
    data = load_system_design()
    for i, entry in enumerate(data["exercises"]):
        if entry["id"] == entry_id:
            updated = request.get_json()
            updated["id"] = entry_id
            data["exercises"][i] = updated
            save_system_design(data)
            return jsonify(updated)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/system-design/<entry_id>", methods=["DELETE"])
def delete_system_design(entry_id):
    data = load_system_design()
    new_exercises = [e for e in data["exercises"] if e["id"] != entry_id]
    if len(new_exercises) == len(data["exercises"]):
        return jsonify({"error": "Not found"}), 404
    data["exercises"] = new_exercises
    save_system_design(data)
    return "", 204


@app.route("/api/companies", methods=["GET"])
def list_companies():
    return jsonify(load_companies()["companies"])


@app.route("/api/companies", methods=["POST"])
def create_company():
    data = load_companies()
    entry = request.get_json()
    entry["id"] = str(uuid.uuid4())
    data["companies"].append(entry)
    save_companies(data)
    return jsonify(entry), 201


@app.route("/api/companies/<entry_id>", methods=["PUT"])
def update_company(entry_id):
    data = load_companies()
    for i, entry in enumerate(data["companies"]):
        if entry["id"] == entry_id:
            updated = request.get_json()
            updated["id"] = entry_id
            data["companies"][i] = updated
            save_companies(data)
            if updated.get("excluded") and not entry.get("excluded"):
                discard_company_jobs(updated.get("company_name"))
            return jsonify(updated)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/companies/exclude", methods=["POST"])
def exclude_company():
    """Flag a company (by name) as one you don't want to work at, or clear the
    flag. Excluding discards its untouched jobs; un-excluding only stops future
    listings being auto-discarded, it doesn't restore anything."""
    body = request.get_json()
    name = (body.get("company") or "").strip()
    if not name:
        return jsonify({"error": "company is required"}), 400
    excluded = bool(body.get("excluded", True))
    ensure_company_exists({"company": name})
    data = load_companies()
    company = next(c for c in data["companies"] if normalize_company(c.get("company_name")) == normalize_company(name))
    company["excluded"] = excluded
    save_companies(data)
    discarded = discard_company_jobs(name) if excluded else 0
    return jsonify({"company": company, "discarded": discarded})


@app.route("/api/companies/<entry_id>", methods=["DELETE"])
def delete_company(entry_id):
    data = load_companies()
    new_companies = [e for e in data["companies"] if e["id"] != entry_id]
    if len(new_companies) == len(data["companies"]):
        return jsonify({"error": "Not found"}), 404
    data["companies"] = new_companies
    save_companies(data)
    return "", 204


@app.route("/api/jobs", methods=["GET"])
def list_jobs():
    migrate_company_contacts()
    jobs = load_jobs()["jobs"]
    for entry in jobs:
        entry.setdefault("status_history", backfill_status_history(entry))
    return jsonify(jobs)


@app.route("/api/jobs", methods=["POST"])
def create_job():
    data = load_jobs()
    entry = request.get_json()
    entry["id"] = str(uuid.uuid4())
    if is_company_excluded(entry.get("company")):
        entry["status"] = "Discarded"
    record_status(entry, [])
    sync_glassdoor_cache(entry)
    ensure_company_exists(entry)
    data["jobs"].append(entry)
    save_jobs(data)
    return jsonify(entry), 201


@app.route("/api/jobs/<entry_id>", methods=["PUT"])
def update_job(entry_id):
    data = load_jobs()
    for i, entry in enumerate(data["jobs"]):
        if entry["id"] == entry_id:
            updated = request.get_json()
            updated["id"] = entry_id
            record_status(updated, entry.get("status_history") or backfill_status_history(entry))
            sync_glassdoor_cache(updated)
            ensure_company_exists(updated)
            data["jobs"][i] = updated
            save_jobs(data)
            return jsonify(updated)
    return jsonify({"error": "Not found"}), 404


def load_search_config():
    path = SEARCH_CONFIG_FILE if os.path.exists(SEARCH_CONFIG_FILE) else SEARCH_CONFIG_EXAMPLE_FILE
    with open(path) as f:
        return json.load(f)


@app.route("/api/search-config", methods=["GET"])
def get_search_config():
    return jsonify(load_search_config())


@app.route("/api/glassdoor-cache", methods=["GET"])
def get_glassdoor_cache():
    return jsonify(load_glassdoor_cache())


@app.route("/api/jobs/<entry_id>", methods=["DELETE"])
def delete_job(entry_id):
    data = load_jobs()
    new_jobs = [e for e in data["jobs"] if e["id"] != entry_id]
    if len(new_jobs) == len(data["jobs"]):
        return jsonify({"error": "Not found"}), 404
    data["jobs"] = new_jobs
    save_jobs(data)
    return "", 204


@app.route("/api/jobs/refresh", methods=["POST"])
def refresh_jobs():
    data = load_jobs()
    checked = 0
    closed = 0
    for entry in data["jobs"]:
        link = entry.get("link")
        # Once you've acted on a job, a closed listing doesn't change where you stand.
        if not link or entry.get("status", "Pending") not in UNTOUCHED_JOB_STATUSES:
            continue
        checked += 1
        if check_job_link_closed(link):
            history = entry.get("status_history") or backfill_status_history(entry)
            entry["status"] = "Closed"
            record_status(entry, history)
            closed += 1
        time.sleep(0.3)
    save_jobs(data)
    return jsonify({"checked": checked, "closed": closed})


if __name__ == "__main__":  # pragma: no cover
    app.run(debug=True, port=5001)  # noqa: S201 - local dev server, bound to 127.0.0.1
