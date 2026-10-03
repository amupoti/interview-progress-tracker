import shutil
from pathlib import Path

import pytest

import app as app_module
import storage

pytest_plugins = ["tests.js_coverage"]

ROOT_DIR = Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "data"
STATIC_FILES = ("questions.json", "challenges.json", "recruiter_questions.json")


@pytest.fixture(autouse=True, scope="session")
def guard_real_data():
    """Abort if anything opens a database outside the test's temp folder,
    so a fixture mistake can never touch the real data/tracker.db."""
    real_connect = storage._connect

    def guarded_connect(database_file):
        resolved = Path(database_file).resolve()
        if resolved.is_relative_to(ROOT_DIR.resolve()):
            pytest.exit(f"Test tried to open a database inside the repo: {resolved}", returncode=3)
        return real_connect(database_file)

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(storage, "_connect", guarded_connect)
        yield


@pytest.fixture(autouse=True)
def tmp_data(tmp_path, monkeypatch):
    for fname in STATIC_FILES:
        shutil.copy(DATA_DIR / fname, tmp_path / fname)

    monkeypatch.setattr(app_module, "DATABASE_FILE", str(tmp_path / "tracker.db"))
    monkeypatch.setattr(app_module, "QUESTIONS_FILE", str(tmp_path / "questions.json"))
    monkeypatch.setattr(app_module, "PRACTICE_FILE", str(tmp_path / "practice.json"))
    monkeypatch.setattr(app_module, "SYSTEM_DESIGN_FILE", str(tmp_path / "system_design.json"))
    monkeypatch.setattr(app_module, "CHALLENGES_FILE", str(tmp_path / "challenges.json"))
    monkeypatch.setattr(app_module, "CHALLENGES_PROGRESS_FILE", str(tmp_path / "challenges_progress.json"))
    monkeypatch.setattr(app_module, "RECRUITER_QUESTIONS_FILE", str(tmp_path / "recruiter_questions.json"))
    monkeypatch.setattr(app_module, "RECRUITER_PRACTICE_FILE", str(tmp_path / "recruiter_practice.json"))
    monkeypatch.setattr(app_module, "COMPANIES_FILE", str(tmp_path / "companies.json"))
    monkeypatch.setattr(app_module, "JOBS_FILE", str(tmp_path / "jobs.json"))
    monkeypatch.setattr(app_module, "GLASSDOOR_CACHE_FILE", str(tmp_path / "glassdoor_cache.json"))
    # Missing on purpose: falls back to the tracked job-search.example.json.
    monkeypatch.setattr(app_module, "SEARCH_CONFIG_FILE", str(tmp_path / "job-search.json"))
    return tmp_path


@pytest.fixture()
def client(tmp_data):
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c
