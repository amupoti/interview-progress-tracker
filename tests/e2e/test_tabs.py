"""Practice, recruiter, challenges, system design, companies, progress and pipeline tabs."""

from datetime import date

import pytest
from playwright.sync_api import expect


def open_tab(open_app, tab, path="/"):
    page = open_app(path)
    page.click(f'.tab-btn[data-tab="{tab}"]')
    expect(page.locator(f"#tab-{tab}")).to_be_visible()
    page.wait_for_load_state("networkidle")
    return page


def test_switching_tabs_shows_one_panel_at_a_time(open_app):
    page = open_app()
    expect(page.locator("#tab-jobs")).to_be_visible()
    page.click('.tab-btn[data-tab="companies"]')
    expect(page.locator("#tab-companies")).to_be_visible()
    expect(page.locator("#tab-jobs")).to_be_hidden()
    expect(page.locator('.tab-btn[data-tab="companies"]')).to_have_class("tab-btn active")
    page.click('.tab-btn[data-tab="jobs"]')
    expect(page.locator("#tab-jobs")).to_be_visible()


# ── Behavioral practice ──────────────────────────────────────────────


def test_practice_reveal_and_complete_all(open_app):
    page = open_tab(open_app, "practice")
    cards = page.locator("#questions-container .q-card")
    expect(cards).to_have_count(3)
    expect(page.locator("#streak-count")).to_have_text("0")

    first = cards.first
    reveal = first.locator(".q-reveal")
    expect(reveal).to_be_hidden()
    first.get_by_role("button", name="Reveal tips").click()
    expect(reveal).to_be_visible()
    expect(first.get_by_role("button", name="Hide tips")).to_be_visible()
    first.get_by_role("button", name="Hide tips").click()
    expect(reveal).to_be_hidden()

    for i in range(3):
        cards.nth(i).get_by_role("button", name="Mark as done").click()
        expect(cards.nth(i)).to_have_class("q-card q-card-done")
    expect(page.locator("#streak-count")).to_have_text("1")
    expect(page.locator(".all-done-msg")).to_contain_text("All done for today")


# ── Recruiter practice ───────────────────────────────────────────────


def test_recruiter_complete_and_reset(open_app):
    page = open_tab(open_app, "recruiter")
    cards = page.locator("#rq-questions-container .q-card")
    expect(cards).to_have_count(5)

    cards.first.get_by_role("button", name="Reveal tips").click()
    expect(cards.first.locator(".q-reveal")).to_be_visible()
    cards.first.get_by_role("button", name="Hide tips").click()

    cards.first.get_by_role("button", name="Mark as done").click()
    expect(cards.first).to_have_class("q-card q-card-done")
    expect(page.locator("#rq-streak-count")).to_have_text("1")

    page.click("#btn-rq-reset")
    expect(page.locator("#rq-questions-container .q-card-done")).to_have_count(0)
    expect(page.locator("#rq-streak-count")).to_have_text("0")


def test_recruiter_complete_all(open_app):
    page = open_tab(open_app, "recruiter")
    for _ in range(5):
        page.get_by_role("button", name="Mark as done").first.click()
    expect(page.locator(".all-done-msg")).to_be_visible()


def test_recruiter_reset_can_be_cancelled(page, live_server):
    page.on("dialog", lambda d: d.dismiss())
    page.goto(live_server)
    page.click('.tab-btn[data-tab="recruiter"]')
    page.get_by_role("button", name="Mark as done").first.click()
    expect(page.locator(".q-card-done")).to_have_count(1)
    page.click("#btn-rq-reset")
    expect(page.locator(".q-card-done")).to_have_count(1)


# ── Code challenges ──────────────────────────────────────────────────


def test_challenges_filter_and_toggle(open_app):
    page = open_tab(open_app, "challenges")
    rows = page.locator("#ch-tbody tr")
    expect(rows).to_have_count(58)
    expect(page.locator("#ch-total")).to_have_text("58")

    page.fill("#ch-search", "two sum")
    expect(rows).to_have_count(1)
    rows.first.locator(".ch-toggle").click()
    expect(rows.first).to_have_class("ch-row-done")
    expect(page.locator("#ch-done")).to_have_text("1")
    expect(page.locator("#ch-easy-done")).to_have_text("1")
    expect(page.locator("#ch-pct")).to_have_text("2%")

    page.fill("#ch-search", "")
    page.select_option("#ch-filter-status", "done")
    expect(rows).to_have_count(1)
    page.select_option("#ch-filter-status", "todo")
    expect(rows).to_have_count(57)

    page.select_option("#ch-filter-status", "")
    page.select_option("#ch-filter-week", "1")
    page.select_option("#ch-filter-diff", "Easy")
    page.select_option("#ch-filter-topic", "Array")
    expect(rows).to_have_count(2)
    for row in rows.all():
        expect(row).to_contain_text("Week 1")
        expect(row).to_contain_text("Array")

    page.fill("#ch-search", "no such problem")
    expect(rows.first).to_contain_text("No problems match")

    # Toggling again marks it as todo.
    page.fill("#ch-search", "two sum")
    for sel in ("#ch-filter-week", "#ch-filter-diff", "#ch-filter-topic"):
        page.select_option(sel, "")
    rows.first.locator(".ch-toggle").click()
    expect(page.locator("#ch-done")).to_have_text("0")


# ── System design ────────────────────────────────────────────────────


def test_system_design_crud(open_app, api):
    page = open_tab(open_app, "system-design")
    expect(page.locator("#sd-empty-row")).to_be_visible()

    page.click("#btn-add-sd")
    expect(page.locator("#sd-f-date")).to_have_value(date.today().isoformat())
    page.click("#sd-form button[type=submit]")
    expect(page.locator("#sd-f-problem")).to_have_class("invalid")

    page.fill("#sd-f-problem", "Design a URL shortener")
    page.select_option("#sd-f-difficulty", "Medium")
    page.fill("#sd-f-score", "4")
    page.fill("#sd-f-url", "https://example.com/sd")
    page.fill("#sd-f-notes", "Forgot rate limiting")
    page.click("#sd-form button[type=submit]")
    expect(page.locator("#sd-modal-overlay")).to_be_hidden()

    row = page.locator("#sd-tbody tr").first
    expect(row).to_contain_text("Design a URL shortener")
    expect(row.locator(".stars")).to_have_text("★★★★☆")
    expect(page.locator("#sd-stat-total")).to_have_text("1")
    expect(page.locator("#sd-stat-week")).to_have_text("1")

    row.get_by_title("Edit").click()
    expect(page.locator("#sd-modal-title")).to_have_text("Edit Exercise")
    page.fill("#sd-f-problem", "Design a paste bin")
    page.click("#sd-form button[type=submit]")
    expect(page.locator("#sd-modal-overlay")).to_be_hidden()
    expect(row).to_contain_text("Design a paste bin")
    assert api.get("/api/system-design").get_json()[0]["problem"] == "Design a paste bin"

    page.locator("#sd-tbody tr").first.get_by_title("Delete").click()
    expect(page.locator("#sd-empty-row")).to_be_visible()
    assert api.get("/api/system-design").get_json() == []


@pytest.mark.parametrize("close", ["#sd-btn-cancel", "#sd-modal-close", "backdrop"])
def test_system_design_modal_closes(open_app, close):
    page = open_tab(open_app, "system-design")
    page.click("#btn-add-sd")
    if close == "backdrop":
        page.mouse.click(5, 5)
    else:
        page.click(close)
    expect(page.locator("#sd-modal-overlay")).to_be_hidden()


# ── Companies ────────────────────────────────────────────────────────


def test_companies_crud_and_search(open_app, api):
    page = open_tab(open_app, "companies")
    expect(page.locator("#co-empty-row")).to_contain_text("No companies yet")

    page.click("#btn-add-co")
    page.click("#co-form button[type=submit]")
    expect(page.locator("#co-f-company_name")).to_have_class("invalid")

    page.fill("#co-f-company_name", "Globex")
    page.fill("#co-f-url", "https://globex.example")
    page.fill("#co-f-industry", "Fintech")
    page.fill("#co-f-location", "Barcelona")
    page.fill("#co-f-interest_level", "5")
    page.fill("#co-f-benefits", "Remote-first, equity")
    page.click("#co-form button[type=submit]")
    expect(page.locator("#co-modal-overlay")).to_be_hidden()

    rows = page.locator("#co-tbody tr")
    expect(rows).to_have_count(1)
    expect(rows.first).to_contain_text("Fintech")
    expect(rows.first.locator(".stars")).to_have_text("★★★★★")

    rows.first.get_by_title("Edit").click()
    expect(page.locator("#co-f-company_name")).to_have_value("Globex")
    page.fill("#co-f-notes", "Met at a meetup")
    page.click("#co-form button[type=submit]")
    expect(page.locator("#co-modal-overlay")).to_be_hidden()
    assert api.get("/api/companies").get_json()[0]["notes"] == "Met at a meetup"

    page.fill("#co-search", "equity")
    expect(rows).to_have_count(1)
    page.fill("#co-search", "healthcare")
    expect(page.locator("#co-empty-row")).to_contain_text("No companies match")
    page.fill("#co-search", "")

    rows.first.get_by_title("Delete").click()
    expect(page.locator("#co-empty-row")).to_contain_text("No companies yet")


@pytest.mark.parametrize("close", ["#co-btn-cancel", "#co-modal-close", "backdrop"])
def test_company_modal_closes(open_app, close):
    page = open_tab(open_app, "companies")
    page.click("#btn-add-co")
    if close == "backdrop":
        page.mouse.click(5, 5)
    else:
        page.click(close)
    expect(page.locator("#co-modal-overlay")).to_be_hidden()


def test_companies_show_glassdoor_and_sort_by_it(open_app, seed_job):
    # Jobs create their companies and fill the Glassdoor cache.
    seed_job(company="Mid Co", glassdoor_rating=3.5, glassdoor_notes="Long hours")
    seed_job(company="Top Co", glassdoor_rating=4.6)
    seed_job(company="Unrated Co")
    page = open_tab(open_app, "companies")

    def names():
        return page.locator("#co-tbody tr strong").all_inner_texts()

    expect(page.locator("#co-tbody tr").filter(has_text="Mid Co")).to_contain_text("Long hours")
    header = page.locator('#co-table th[data-col="glassdoor"]')
    header.click()
    expect(header).to_have_class("sort-desc")
    assert names() == ["Top Co", "Mid Co", "Unrated Co"]
    header.click()
    expect(header).to_have_class("sort-asc")
    assert names() == ["Unrated Co", "Mid Co", "Top Co"]


def test_exclude_and_restore_company(open_app, seed_job, api):
    seed_job(company="Bad Corp", title="Role One")
    page = open_tab(open_app, "companies")
    row = page.locator("#co-tbody tr").filter(has_text="Bad Corp")

    row.get_by_title("Exclude company — discard its jobs").click()
    expect(row).to_have_class("row-excluded")
    expect(row.locator(".badge-excluded")).to_be_visible()
    assert api.get("/api/jobs").get_json()[0]["status"] == "Discarded"

    # Editing an excluded company keeps it excluded.
    row.get_by_title("Edit").click()
    page.fill("#co-f-notes", "Still no")
    page.click("#co-form button[type=submit]")
    expect(page.locator("#co-modal-overlay")).to_be_hidden()
    assert api.get("/api/companies").get_json()[0]["excluded"] is True

    row.get_by_title("Stop excluding this company").click()
    expect(row).not_to_have_class("row-excluded")
    # Already-discarded jobs stay discarded.
    assert api.get("/api/jobs").get_json()[0]["status"] == "Discarded"


def test_companies_tab_loads_glassdoor_after_visiting_jobs_first(open_app, seed_job):
    # The Jobs tab loads companies on startup but not the Glassdoor cache.
    seed_job(company="Rated Co", glassdoor_rating=4.0)
    page = open_tab(open_app, "companies")
    expect(page.locator("#co-tbody tr").filter(has_text="Rated Co")).to_contain_text("4")


# ── Progress ─────────────────────────────────────────────────────────


def test_progress_reflects_activity(open_app, api):
    api.get("/api/practice/today")
    api.post("/api/practice/complete", json={"question_id": 1})
    api.post("/api/recruiter/complete", json={"question_id": 1})
    api.post("/api/challenges/toggle", json={"id": 1})
    api.post("/api/system-design", json={"problem": "Chat app", "date": date.today().isoformat()})

    page = open_tab(open_app, "progress")
    expect(page.locator("#prog-streak")).to_have_text("1")
    expect(page.locator("#prog-total-q")).to_have_text("1")
    expect(page.locator("#prog-total-sd")).to_have_text("1")
    expect(page.locator("#prog-sd-week")).to_have_text("1")
    expect(page.locator("#prog-challenges")).to_have_text("1/58")
    expect(page.locator("#prog-rq-streak")).to_have_text("1")
    expect(page.locator("#prog-total-rq")).to_have_text("1")

    days = page.locator("#combined-cal-grid .cal-day")
    expect(days).to_have_count(7)
    today = page.locator(".cal-day.cal-today")
    expect(today).to_have_count(1)
    expect(today.locator(".cal-dot")).to_contain_text("🧠 1/3")
    expect(today.locator(".cal-sd-dot")).to_contain_text("🏗 1")
    expect(today.locator(".cal-ch-dot")).to_contain_text("💻 1")
    expect(today.locator(".cal-rq-dot")).to_contain_text("🎤 1")


# ── Pipeline ─────────────────────────────────────────────────────────


def test_pipeline_empty_state(open_app, seed_job):
    seed_job()
    page = open_tab(open_app, "pipeline")
    expect(page.locator("#pipeline-chart")).to_contain_text("No status changes yet")
    expect(page.locator("#pipeline-summary")).to_have_text("0 of 1 jobs shown")


def test_pipeline_chart_and_table(open_app, seed_job, api):
    for title, path in [
        ("A", ["Applied", "Interviewing", "Offer"]),
        ("B", ["Applied", "Rejected"]),
        ("C", ["Interested", "Applied"]),
    ]:
        job = seed_job(title=title)
        for status in path:
            job = api.put(f"/api/jobs/{job['id']}", json={**job, "status": status}).get_json()
    seed_job(title="Untouched")

    page = open_tab(open_app, "pipeline")
    expect(page.locator("#pipeline-summary")).to_have_text("3 of 4 jobs shown")
    expect(page.locator("#pipeline-chart svg")).to_be_visible()
    for status in ("Pending", "Interested", "Applied", "Interviewing", "Offer", "Rejected"):
        expect(page.locator(f'#pipeline-chart [data-node="{status}"]')).to_have_count(1)

    page.click(".pipeline-table summary")
    links = page.locator("#pipeline-tbody tr")
    expect(links.filter(has_text="Pending").filter(has_text="Applied").locator("td").last).to_have_text("2")
    expect(links.filter(has_text="Interviewing").filter(has_text="Offer").locator("td").last).to_have_text("1")

    page.check("#pipeline-include-untouched")
    expect(page.locator("#pipeline-summary")).to_have_text("4 of 4 jobs shown")

    # Hovering shows a tooltip for nodes and flows.
    tooltip = page.locator("#pipeline-tooltip")
    page.locator('#pipeline-chart [data-node="Applied"] rect').hover()
    expect(tooltip).to_contain_text("3 jobs reached")
    page.locator("#pipeline-chart [data-flow]").first.hover()
    expect(tooltip).to_contain_text("→")
    page.mouse.move(1, 1)
    expect(tooltip).to_be_hidden()

    # The chart redraws to the new width on resize while the tab is visible.
    svg = page.locator("#pipeline-chart svg")
    before = svg.get_attribute("width")
    page.set_viewport_size({"width": 700, "height": 800})
    expect(svg).not_to_have_attribute("width", before)
