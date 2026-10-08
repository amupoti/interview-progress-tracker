"""Unit-style tests for the pure helpers in static/app.js, run in the real page."""

import pytest


@pytest.fixture(scope="module")
def js(browser, live_server, js_coverage):
    # These helpers don't depend on data, so one page serves the whole module.
    page = browser.new_page()
    cdp = js_coverage.start(page)
    page.goto(live_server)
    page.wait_for_load_state("networkidle")
    yield lambda expr, arg=None: page.evaluate(expr, arg)
    js_coverage.stop(cdp)
    page.close()


@pytest.mark.parametrize(
    "score, badge",
    [
        (100, "badge-match-high"),
        (75, "badge-match-high"),
        (74, "badge-match-mid"),
        (50, "badge-match-mid"),
        (49, "badge-match-low"),
        (0, "badge-match-low"),
        ("80", "badge-match-high"),
    ],
)
def test_match_badge_thresholds(js, score, badge):
    assert js("s => matchBadge(s)", score) == badge


def test_job_status_rank_orders_furthest_along_first(js):
    ranks = js("""() => ['Offer', 'Interviewing', 'Applied', 'Interested', 'Pending',
                         'Rejected', 'Ghosted', 'Discarded', 'Closed'].map(status => jobStatusRank({ status }))""")
    assert ranks == sorted(ranks)


def test_job_status_rank_defaults_missing_to_pending_and_unknown_to_last(js):
    assert js("() => jobStatusRank({})") == js("() => jobStatusRank({ status: 'Pending' })")
    assert js("() => jobStatusRank({ status: 'Withdrawn' })") == 9


@pytest.mark.parametrize(
    "col, job, expected",
    [
        ("company", {"company": "ACME"}, "acme"),
        ("company", {}, ""),
        ("glassdoor_rating", {"glassdoor_rating": "4.2"}, 4.2),
        ("glassdoor_rating", {"glassdoor_rating": None}, -1),
        ("glassdoor_rating", {"glassdoor_rating": ""}, -1),
        ("match_score", {"match_score": 0}, 0),
        ("match_score", {}, -1),
        ("date_added", {"date_added": "2026-01-02"}, "2026-01-02"),
        ("unknown", {"company": "x"}, ""),
    ],
)
def test_jobs_col_value(js, col, job, expected):
    assert js("([j, c]) => jobsColValue(j, c)", [job, col]) == expected


def test_job_sinks_to_bottom_only_for_rejected_ghosted_and_discarded(js):
    sunk = js("""() => ['Pending', 'Applied', 'Offer', 'Closed', 'Rejected', 'Ghosted', 'Discarded']
                       .map(status => jobSinksToBottom({ status }))""")
    assert sunk == [0, 0, 0, 0, 1, 1, 1]


@pytest.mark.parametrize(
    "history, expected",
    [
        ([], []),
        (["Pending", "Applied", "Interviewing"], ["Pending", "Applied", "Interviewing"]),
        # Moving back undoes the later steps.
        (["Pending", "Applied", "Interviewing", "Applied"], ["Pending", "Applied"]),
        # Rejected, Ghosted and Discarded share a column, so one replaces the other.
        (["Pending", "Rejected", "Discarded"], ["Pending", "Discarded"]),
        # Unknown statuses are ignored.
        (["Pending", "Withdrawn", "Applied"], ["Pending", "Applied"]),
        (["Applied", "Ghosted", "Rejected"], ["Applied", "Rejected"]),
    ],
)
def test_pipeline_path(js, history, expected):
    path = js("h => pipelinePath(h.map(status => ({ status })))", history)
    assert path == expected


@pytest.mark.parametrize(
    "raw, escaped",
    [
        ('<img src=x onerror="alert(1)">', "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"),
        ("Tom & Jerry", "Tom &amp; Jerry"),
        (None, ""),
        ("", ""),
        (0, ""),
    ],
)
def test_esc(js, raw, escaped):
    assert js("s => esc(s)", raw) == escaped


def test_format_date(js):
    assert js("() => formatDate('2026-10-02')") == "02/10/2026"
    assert js("() => formatDate('')") == "—"


@pytest.mark.parametrize("raw, expected", [("4.5", 4.5), ("3", 3), ("", None), ("abc", None)])
def test_to_num(js, raw, expected):
    assert js("s => toNum(s)", raw) == expected


def test_stars_clamps_between_one_and_five(js):
    assert js("() => stars(3)").count("★") == 3
    assert js("() => stars(9)").count("★") == 5
    assert js("() => stars(-2)").count("★") == 1
    assert js("() => stars(null)") == "—"
