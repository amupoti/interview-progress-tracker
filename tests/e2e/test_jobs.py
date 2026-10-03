"""Jobs tab: the default view, where most of the app's logic lives."""

from datetime import date, datetime, timedelta, timezone

import pytest
from playwright.sync_api import expect


def rows(page):
    return page.locator("#jobs-tbody tr")


def row_for(page, text):
    return rows(page).filter(has_text=text)


def save_job_form(page):
    """Submit the job modal and wait for the save to finish."""
    page.click("#jobs-form button[type=submit]")
    expect(page.locator("#jobs-modal-overlay")).to_be_hidden()


def test_empty_state(open_app):
    page = open_app()
    expect(page.locator("#jobs-empty-row")).to_contain_text("No jobs yet")
    expect(page.locator("#jobs-count")).to_have_text("0 openings")


def test_add_job_with_contact(open_app, api):
    page = open_app()
    page.click("#btn-add-job")
    expect(page.locator("#jobs-modal-overlay")).to_be_visible()
    expect(page.locator("#jobs-f-date_added")).not_to_have_value("")

    page.fill("#jobs-f-company", "Globex")
    page.fill("#jobs-f-title", "Staff Engineer")
    page.fill("#jobs-f-location", "Barcelona")
    page.select_option("#jobs-f-work_mode", "Hybrid")
    page.select_option("#jobs-f-level", "Senior")
    page.fill("#jobs-f-glassdoor_rating", "4.1")
    page.fill("#jobs-contacts-list .contact-name", "Jane Doe")
    save_job_form(page)
    row = row_for(page, "Staff Engineer")
    expect(row).to_contain_text("Globex")
    expect(row).to_contain_text("🤝 Jane Doe")
    expect(row.locator(".badge-hybrid")).to_have_text("Hybrid")
    expect(page.locator("#jobs-count")).to_have_text("1 opening")

    [saved] = api.get("/api/jobs").get_json()
    assert saved["glassdoor_rating"] == 4.1
    assert saved["contacts"] == [{"name": "Jane Doe", "title": "", "email": ""}]

    page.reload()
    expect(row_for(page, "Staff Engineer")).to_be_visible()


def test_add_job_requires_company_and_title(open_app, api):
    page = open_app()
    page.click("#btn-add-job")
    page.click("#jobs-form button[type=submit]")
    expect(page.locator("#jobs-f-company")).to_have_class("invalid")
    expect(page.locator("#jobs-f-title")).to_have_class("invalid")
    expect(page.locator("#jobs-modal-overlay")).to_be_visible()

    page.fill("#jobs-f-company", "Globex")
    page.click("#jobs-form button[type=submit]")
    expect(page.locator("#jobs-f-company")).not_to_have_class("invalid")
    expect(page.locator("#jobs-f-title")).to_be_focused()
    assert api.get("/api/jobs").get_json() == []


def test_cancel_and_close_modal(open_app):
    page = open_app()
    for close in ("#jobs-btn-cancel", "#jobs-modal-close"):
        page.click("#btn-add-job")
        page.click(close)
        expect(page.locator("#jobs-modal-overlay")).to_be_hidden()
    page.click("#btn-add-job")
    page.mouse.click(5, 5)  # backdrop
    expect(page.locator("#jobs-modal-overlay")).to_be_hidden()


def test_contact_rows_can_be_added_and_removed(open_app, api):
    page = open_app()
    page.click("#btn-add-job")
    page.fill("#jobs-f-company", "Globex")
    page.fill("#jobs-f-title", "Engineer")
    page.click("#jobs-btn-add-contact")
    page.click("#jobs-btn-add-contact")
    contacts = page.locator("#jobs-contacts-list .contact-row")
    expect(contacts).to_have_count(3)
    contacts.nth(0).locator(".contact-name").fill("Keep Me")
    contacts.nth(1).locator(".contact-name").fill("Remove Me")
    contacts.nth(1).locator("button").click()
    expect(contacts).to_have_count(2)
    save_job_form(page)

    [saved] = api.get("/api/jobs").get_json()
    assert [c["name"] for c in saved["contacts"]] == ["Keep Me"]


def test_edit_keeps_fields_the_form_does_not_show(open_app, seed_job, api):
    seed_job(title="Backend Engineer", match_score=82, match_notes="Strong Python fit")
    page = open_app()
    row_for(page, "Backend Engineer").get_by_title("Edit").click()
    expect(page.locator("#jobs-modal-title")).to_have_text("Edit Job")
    expect(page.locator("#jobs-f-title")).to_have_value("Backend Engineer")
    page.fill("#jobs-f-notes", "Referral pending")
    save_job_form(page)

    [saved] = api.get("/api/jobs").get_json()
    assert saved["notes"] == "Referral pending"
    assert saved["match_score"] == 82
    assert saved["match_notes"] == "Strong Python fit"


def test_edit_job_with_unconfigured_level(open_app, seed_job):
    seed_job(title="Lead Engineer", level="Principal")
    page = open_app()
    row_for(page, "Lead Engineer").get_by_title("Edit").click()
    expect(page.locator("#jobs-f-level")).to_have_value("Principal")


def test_inline_status_change_persists_and_records_history(open_app, seed_job, api):
    seed_job(title="Platform Engineer")
    page = open_app()
    row_for(page, "Platform Engineer").locator("select.status-select").select_option("Applied")
    expect(row_for(page, "Platform Engineer").locator("select.status-select")).to_have_class(
        "badge status-select badge-applied"
    )

    [saved] = api.get("/api/jobs").get_json()
    assert saved["status"] == "Applied"
    assert [h["status"] for h in saved["status_history"]] == ["Pending", "Applied"]

    page.reload()
    expect(row_for(page, "Platform Engineer").locator("select.status-select")).to_have_value("Applied")


def test_search_matches_contacts_and_notes(open_app, seed_job):
    seed_job(company="Initech", title="Engineer A", contacts=[{"name": "Peter Gibbons"}])
    seed_job(company="Hooli", title="Engineer B", notes="Great culture, flat structure")
    seed_job(company="Umbrella", title="Engineer C")
    page = open_app()
    expect(rows(page)).to_have_count(3)

    page.fill("#jobs-search", "gibbons")
    expect(rows(page)).to_have_count(1)
    expect(rows(page)).to_contain_text("Initech")
    expect(page.locator("#jobs-count")).to_have_text("1 of 3 openings")

    page.fill("#jobs-search", "flat structure")
    expect(rows(page)).to_contain_text("Hooli")

    page.fill("#jobs-search", "nothing matches this")
    expect(page.locator("#jobs-empty-row")).to_contain_text("No jobs match your search")


def test_filters_are_saved_in_the_url(open_app, seed_job):
    seed_job(company="Remote Co", work_mode="Remote", status="Applied")
    seed_job(company="Office Co", work_mode="Onsite", status="Applied")
    seed_job(company="Remote Pending", work_mode="Remote")
    page = open_app()

    page.select_option("#jobs-work-mode-filter", "Remote")
    expect(rows(page)).to_have_count(2)
    page.select_option("#jobs-status-filter", "Applied")
    expect(rows(page)).to_have_count(1)
    expect(rows(page)).to_contain_text("Remote Co")
    assert "work_mode=Remote" in page.url and "status=Applied" in page.url

    page.select_option("#jobs-work-mode-filter", "")
    assert "work_mode" not in page.url
    expect(rows(page)).to_have_count(2)


def test_filters_are_restored_from_the_url(open_app, seed_job):
    seed_job(company="Staff Co", level="Staff", status="Interviewing")
    seed_job(company="Senior Co", level="Senior", status="Interviewing")
    page = open_app("/?level=Staff&status=Interviewing&work_mode=Bogus")
    # Staff isn't in job-search.example.json, so it is added on the fly.
    expect(page.locator("#jobs-level-filter")).to_have_value("Staff")
    expect(page.locator("#jobs-status-filter")).to_have_value("Interviewing")
    expect(page.locator("#jobs-work-mode-filter")).to_have_value("")
    expect(rows(page)).to_have_count(1)
    expect(rows(page)).to_contain_text("Staff Co")


def test_default_order(open_app, seed_job):
    seed_job(company="Pending Low", glassdoor_rating=2.0)
    seed_job(company="Pending High", glassdoor_rating=4.5)
    seed_job(company="Pending Contact", contacts=[{"name": "Ann"}])
    seed_job(company="Rejected Co", status="Rejected")
    seed_job(company="Offer Co", status="Offer")
    page = open_app()
    companies = rows(page).locator("td:first-child span:not(.badge)").all_inner_texts()
    assert companies == ["Offer Co", "Pending Contact", "Pending High", "Pending Low", "Rejected Co"]


def test_sorting_toggles_and_keeps_rejected_last(open_app, seed_job):
    seed_job(company="Beta")
    seed_job(company="Alpha", status="Rejected")
    seed_job(company="Gamma", status="Discarded")
    seed_job(company="Delta")
    page = open_app()
    header = page.locator('#jobs-table th[data-col="company"]')

    def names():
        return rows(page).locator("td:first-child span:not(.badge)").all_inner_texts()

    header.click()
    expect(header).to_have_class("sort-asc")
    assert names() == ["Beta", "Delta", "Alpha", "Gamma"]

    header.click()
    expect(header).to_have_class("sort-desc")
    assert names() == ["Delta", "Beta", "Gamma", "Alpha"]


def test_sort_by_match_score_puts_unscored_first_ascending(open_app, seed_job):
    seed_job(company="Scored High", match_score=90)
    seed_job(company="Unscored")
    seed_job(company="Scored Low", match_score=40)
    page = open_app()
    page.click('#jobs-table th[data-col="match_score"]')
    assert rows(page).locator("td:first-child span:not(.badge)").all_inner_texts() == [
        "Unscored",
        "Scored Low",
        "Scored High",
    ]
    expect(row_for(page, "Scored High").locator(".badge-match-high")).to_have_text("90")


@pytest.mark.parametrize(
    "col, expected",
    [
        ("level", ["No Level", "Senior Co", "Staff Co"]),
        ("location", ["No Level", "Senior Co", "Staff Co"]),
        ("status", ["Staff Co", "Senior Co", "No Level"]),
        ("glassdoor_rating", ["No Level", "Senior Co", "Staff Co"]),
        ("date_added", ["Staff Co", "Senior Co", "No Level"]),
    ],
)
def test_sort_by_other_columns(open_app, seed_job, col, expected):
    seed_job(
        company="Staff Co",
        level="Staff",
        location="Valencia",
        status="Offer",
        glassdoor_rating=4.8,
        date_added="2026-01-01",
    )
    seed_job(
        company="Senior Co",
        level="Senior",
        location="Barcelona",
        status="Applied",
        glassdoor_rating=3.9,
        date_added="2026-02-01",
    )
    seed_job(company="No Level", location="", date_added="2026-03-01")
    page = open_app()
    page.click(f'#jobs-table th[data-col="{col}"]')
    assert rows(page).locator("td:first-child span:not(.badge)").all_inner_texts() == expected


def test_sort_keeps_ties_in_place(open_app, seed_job):
    seed_job(company="Same", title="First")
    seed_job(company="Same", title="Second")
    page = open_app()
    page.click('#jobs-table th[data-col="company"]')
    assert rows(page).locator("td:first-child strong").all_inner_texts() == ["First", "Second"]


def test_failed_status_change_alerts_and_reverts(page, live_server, seed_job):
    seed_job(title="Flaky Save")
    messages = []
    page.on("dialog", lambda d: (messages.append(d.message), d.accept()))
    page.route(
        "**/api/jobs/*", lambda route: route.fulfill(status=500) if route.request.method == "PUT" else route.continue_()
    )
    page.goto(live_server)
    select = row_for(page, "Flaky Save").locator("select.status-select")
    select.select_option("Applied")
    expect(select).to_have_value("Pending")
    assert messages == ["Could not update status."]


def test_failed_exclude_alerts(page, live_server, seed_job, api):
    seed_job(company="Bad Corp", title="Role One")
    page.on("dialog", lambda d: d.accept())
    page.route("**/api/companies/exclude", lambda route: route.fulfill(status=500))
    page.goto(live_server)
    with page.expect_event("dialog") as confirm_dialog:
        row_for(page, "Role One").get_by_title("Exclude Bad Corp — discard all its jobs").click()
    assert confirm_dialog.value.message.startswith('Exclude "Bad Corp"?')
    with page.expect_event("dialog") as alert_dialog:
        pass
    assert alert_dialog.value.message == "Could not update company."
    assert api.get("/api/jobs").get_json()[0]["status"] == "Pending"


def test_exclude_company_discards_untouched_jobs(open_app, seed_job, api):
    seed_job(company="Bad Corp", title="Role One")
    seed_job(company="Bad Corp", title="Role Two", status="Applied")
    page = open_app()
    row_for(page, "Role One").get_by_title("Exclude Bad Corp — discard all its jobs").click()
    expect(row_for(page, "Role One").locator("select.status-select")).to_have_value("Discarded")
    expect(row_for(page, "Role Two").locator("select.status-select")).to_have_value("Applied")

    [company] = api.get("/api/companies").get_json()
    assert company["excluded"] is True


def test_dismissing_a_confirm_changes_nothing(page, live_server, seed_job, api):
    seed_job(company="Keep Corp", title="Keep Me")
    page.on("dialog", lambda d: d.dismiss())
    page.goto(live_server)
    row_for(page, "Keep Me").get_by_title("Delete").click()
    row_for(page, "Keep Me").get_by_title("Exclude Keep Corp — discard all its jobs").click()
    expect(row_for(page, "Keep Me")).to_be_visible()
    [job] = api.get("/api/jobs").get_json()
    assert job["status"] == "Pending"


def test_delete_job(open_app, seed_job, api):
    seed_job(title="Delete Me")
    seed_job(title="Keep Me")
    page = open_app()
    row_for(page, "Delete Me").get_by_title("Delete").click()
    expect(rows(page)).to_have_count(1)
    assert [j["title"] for j in api.get("/api/jobs").get_json()] == ["Keep Me"]


def test_upcoming_interviews_panel(open_app, seed_job):
    soon = (date.today() + timedelta(days=2)).isoformat()
    later = (date.today() + timedelta(days=30)).isoformat()
    seed_job(company="Soon Co", status="Interviewing", next_interview_date=soon, next_interview_type="Technical")
    seed_job(company="Later Co", status="Interviewing", next_interview_date=later)
    seed_job(company="Rejected Co", status="Rejected", next_interview_date=soon)
    page = open_app()
    panel = page.locator("#upcoming-section")
    expect(panel).to_be_visible()
    expect(panel.locator("li")).to_have_count(1)
    expect(panel).to_contain_text("Soon Co")
    expect(panel).to_contain_text("Technical")


def test_upcoming_panel_hidden_without_interviews(open_app, seed_job):
    seed_job()
    page = open_app()
    expect(page.locator("#upcoming-section")).to_be_hidden()


def test_scraped_html_is_not_executed(open_app, seed_job):
    payload = '<img src=x onerror="window.__xss = 1">'
    seed_job(company=payload, title=payload, notes=payload, contacts=[{"name": payload}])
    page = open_app()
    expect(rows(page).first).to_contain_text(payload)
    assert page.evaluate("window.__xss") is None


@pytest.mark.xfail(
    strict=True, reason="todayISO() uses the UTC date, so it's a day behind just after local midnight east of UTC"
)
@pytest.mark.browser_context_args(timezone_id="Europe/Madrid")
def test_new_job_defaults_to_local_date_after_midnight(page, live_server):
    # 00:30 in Madrid on 2 October is still 1 October in UTC.
    page.clock.set_fixed_time(datetime(2026, 10, 1, 22, 30, tzinfo=timezone.utc))
    page.goto(live_server)
    page.click("#btn-add-job")
    expect(page.locator("#jobs-f-date_added")).to_have_value("2026-10-02", timeout=1000)
