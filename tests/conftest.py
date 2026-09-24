import shutil
from pathlib import Path

import pytest

import app as app_module

DATA_DIR = Path(__file__).parent.parent / "data"
STATIC_FILES = ("questions.json", "challenges.json", "recruiter_questions.json")


@pytest.fixture()
def tmp_data(tmp_path, monkeypatch):
    for fname in STATIC_FILES:
        shutil.copy(DATA_DIR / fname, tmp_path / fname)

    monkeypatch.setattr(app_module, "DATABASE_FILE",            str(tmp_path / "tracker.db"))
    monkeypatch.setattr(app_module, "QUESTIONS_FILE",           str(tmp_path / "questions.json"))
    monkeypatch.setattr(app_module, "PRACTICE_FILE",            str(tmp_path / "practice.json"))
    monkeypatch.setattr(app_module, "SYSTEM_DESIGN_FILE",       str(tmp_path / "system_design.json"))
    monkeypatch.setattr(app_module, "CHALLENGES_FILE",          str(tmp_path / "challenges.json"))
    monkeypatch.setattr(app_module, "CHALLENGES_PROGRESS_FILE", str(tmp_path / "challenges_progress.json"))
    monkeypatch.setattr(app_module, "RECRUITER_QUESTIONS_FILE", str(tmp_path / "recruiter_questions.json"))
    monkeypatch.setattr(app_module, "RECRUITER_PRACTICE_FILE",  str(tmp_path / "recruiter_practice.json"))
    monkeypatch.setattr(app_module, "COMPANIES_FILE",           str(tmp_path / "companies.json"))
    monkeypatch.setattr(app_module, "JOBS_FILE",                str(tmp_path / "jobs.json"))
    return tmp_path


@pytest.fixture()
def client(tmp_data):
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c
