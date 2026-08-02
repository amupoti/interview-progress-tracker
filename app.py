import json
import os
import random as _random
import uuid
from datetime import date, timedelta
from flask import Flask, jsonify, request, render_template
from storage import load_state, save_state

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "interviews.json")
DATABASE_FILE = os.path.join(os.path.dirname(__file__), "data", "tracker.db")
QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "data", "questions.json")
PRACTICE_FILE = os.path.join(os.path.dirname(__file__), "data", "practice.json")
SYSTEM_DESIGN_FILE = os.path.join(os.path.dirname(__file__), "data", "system_design.json")
CHALLENGES_FILE = os.path.join(os.path.dirname(__file__), "data", "challenges.json")
CHALLENGES_PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "data", "challenges_progress.json")
RECRUITER_QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "data", "recruiter_questions.json")
RECRUITER_PRACTICE_FILE = os.path.join(os.path.dirname(__file__), "data", "recruiter_practice.json")


def load_data():
    return load_state(DATABASE_FILE, "interviews", [], DATA_FILE)


def save_data(data):
    save_state(DATABASE_FILE, "interviews", data)


def load_questions():
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


def load_practice():
    return load_state(DATABASE_FILE, "practice", {"history": {}}, PRACTICE_FILE)


def save_practice(data):
    save_state(DATABASE_FILE, "practice", data)


def load_system_design():
    return load_state(
        DATABASE_FILE, "system_design", {"exercises": []}, SYSTEM_DESIGN_FILE
    )


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


@app.route("/api/interviews", methods=["GET"])
def list_interviews():
    return jsonify(load_data())


@app.route("/api/interviews", methods=["POST"])
def create_interview():
    data = load_data()
    entry = request.get_json()
    entry["id"] = str(uuid.uuid4())
    if not entry.get("application_date"):
        entry["application_date"] = date.today().isoformat()
    data.append(entry)
    save_data(data)
    return jsonify(entry), 201


@app.route("/api/interviews/<entry_id>", methods=["PUT"])
def update_interview(entry_id):
    data = load_data()
    for i, entry in enumerate(data):
        if entry["id"] == entry_id:
            updated = request.get_json()
            updated["id"] = entry_id
            data[i] = updated
            save_data(data)
            return jsonify(updated)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/interviews/<entry_id>", methods=["DELETE"])
def delete_interview(entry_id):
    data = load_data()
    new_data = [e for e in data if e["id"] != entry_id]
    if len(new_data) == len(data):
        return jsonify({"error": "Not found"}), 404
    save_data(new_data)
    return "", 204


@app.route("/api/practice/today", methods=["GET"])
def practice_today():
    questions = load_questions()
    practice = load_practice()
    today = date.today().isoformat()

    rng = _random.Random(int(date.today().strftime("%Y%m%d")))
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

    return jsonify({
        "questions": selected_questions,
        "completed": completed,
        "streak": compute_streak(practice["history"]),
    })


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
        calendar.append({
            "date": key,
            "completed": len(day_data.get("completed", [])),
            "total": len(day_data.get("questions", [])) or 3,
        })

    total_completed = sum(
        len(v.get("completed", [])) for v in practice["history"].values()
    )
    return jsonify({
        "calendar": calendar,
        "streak": compute_streak(practice["history"]),
        "total_completed": total_completed,
    })


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
        calendar.append({
            "date": key,
            "questions_completed": len(day_data.get("completed", [])),
            "questions_total": len(day_data.get("questions", [])) or 3,
            "sd_count": sd_count,
            "ch_count": ch_count,
            "rq_count": rq_count,
        })

    total_questions = sum(
        len(v.get("completed", [])) for v in practice["history"].values()
    )
    total_rq = sum(
        len(v.get("completed", [])) for v in rq_practice["history"].values()
    )
    week_ago = today - timedelta(days=7)
    sd_this_week = sum(
        1 for e in sd_data["exercises"]
        if e.get("date") and date.fromisoformat(e["date"]) >= week_ago
    )

    challenges_done = len(ch_progress["completed"])
    challenges_total = len(load_challenges())

    return jsonify({
        "streak": compute_streak(practice["history"]),
        "rq_streak": compute_streak(rq_practice["history"]),
        "total_questions": total_questions,
        "total_rq": total_rq,
        "total_sd": len(sd_data["exercises"]),
        "sd_this_week": sd_this_week,
        "challenges_done": challenges_done,
        "challenges_total": challenges_total,
        "calendar": calendar,
    })


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

    rng = _random.Random(int(date.today().strftime("%Y%m%d")) + 1)
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

    return jsonify({
        "questions": selected_questions,
        "completed": completed,
        "streak": compute_streak(practice["history"]),
    })


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


if __name__ == "__main__":
    app.run(debug=True, port=5000)
