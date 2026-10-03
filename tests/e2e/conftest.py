"""Browser tests: a real Flask server on a random port, driven by Playwright.

The server runs in this process, so it shares the per-test temporary database
set up by the autouse ``tmp_data`` fixture in ``tests/conftest.py``.
"""

import threading

import pytest
from werkzeug.serving import make_server

import app as app_module


@pytest.fixture(scope="session")
def live_server():
    server = make_server("127.0.0.1", 0, app_module.app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


@pytest.fixture()
def page(context, js_coverage):
    """pytest-playwright's page, recording app.js coverage from before the first load."""
    page = context.new_page()
    cdp = js_coverage.start(page)
    yield page
    js_coverage.stop(cdp)


@pytest.fixture()
def api(tmp_data):
    """Flask test client for seeding data before the page loads."""
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


@pytest.fixture()
def seed_job(api):
    def seed(**fields):
        job = {"company": "Acme", "title": "Senior Engineer", "status": "Pending", **fields}
        res = api.post("/api/jobs", json=job)
        assert res.status_code == 201
        return res.get_json()

    return seed


@pytest.fixture()
def open_app(page, live_server):
    """Open the app at ``path`` and wait until its initial fetches settle.
    Confirm dialogs are accepted unless a test registers its own handler."""
    page.on("dialog", lambda d: d.accept())

    def open_(path="/"):
        page.goto(live_server + path)
        page.wait_for_load_state("networkidle")
        return page

    return open_
