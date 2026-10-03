# Interview Progress Tracker

[![CI](https://github.com/amupoti/interview-progress-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/amupoti/interview-progress-tracker/actions/workflows/ci.yml)
[![CodeQL](https://github.com/amupoti/interview-progress-tracker/actions/workflows/codeql.yml/badge.svg)](https://github.com/amupoti/interview-progress-tracker/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A lightweight web app to track your software engineering job applications — built with Python/Flask and vanilla JS.

## Requirements

- Python 3.10+ (CI tests 3.10–3.13)

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the app
python app.py
```

Then open **http://localhost:5001** in your browser.

> **Note (macOS):** port 5000 is used by AirPlay Receiver on modern macOS, which returns
> a `403 Forbidden` for unrelated requests — that's why this app defaults to 5001.

Mutable data is automatically saved to the local SQLite database at `data/tracker.db`.
Existing JSON data is imported automatically the first time each data set is accessed.

## Features

- **Jobs tab** — every listing you're tracking, from first sighting through to offer (see below)
- Upcoming interviews panel (next 7 days) at the top of the Jobs tab
- **Pipeline tab** — a Sankey chart of how jobs have moved between statuses
- Behavioral, recruiter, code-challenge, and system-design practice tabs, with a combined Progress view

## Jobs tab

The Jobs tab tracks each listing from the moment you find it until it ends in an offer, a rejection, or you drop it. Add, edit, and delete entries from the table.

**Fields tracked per job**

| Field | Description |
|---|---|
| Company | Name of the company |
| Job Title | Role as listed |
| Location | City/country as listed |
| Work Mode | `Remote`, `Hybrid`, or `Onsite` |
| Level | One of the `levels` in `job-search.json`, or `Other` |
| Link | URL to the original listing |
| Glassdoor Rating | 0–5 stars |
| Glassdoor Notes | Review highlights, red flags, sample size caveats, etc. |
| Status | `Pending` (default) → `Interested` → `Applied` → `Interviewing` → `Offer` / `Rejected` / `Discarded` |
| Date Added | Defaults to today |
| Next Interview Date / Type | Upcoming round (e.g. Recruiter Screen, Technical, On-site); feeds the Upcoming Interviews panel |
| Notes | Freeform notes |

**Filtering and sorting**

- Filter by work mode (Remote / Hybrid / Onsite), by level (the configured levels, or Other), or free-text search across company, title, location, level, and notes.
- Click any column header to sort by it.
- With no column sort active, rows default-sort **by how far along the process they are**: `Offer` → `Interviewing` → `Applied` → `Interested` → `Pending`, then closed-out `Rejected` / `Discarded` / `Closed` at the bottom. Sorting by the Status column uses the same order.
- Within a status, **referral-aware ranking** applies: any job at a company that has a contact listed in the **Companies** tab floats to the top, with Glassdoor rating as the tiebreaker.

New listings land in the `Pending` status so you can review them in bulk and manually promote the ones worth pursuing to `Interested`.

Every status change is recorded with its date in the job's `status_history`, which is what the **Pipeline** tab charts.

### How the LinkedIn/Glassdoor data gets in

There is no LinkedIn or Glassdoor API integration, no stored credentials, and no background scraping job. The app itself only exposes a REST API (`GET/POST /api/jobs`, `PUT/DELETE /api/jobs/<id>`) for whatever job data you give it.

Glassdoor ratings are cached server-side by company (`GET /api/glassdoor-cache`), since they rarely change: posting a job with a `glassdoor_rating` stores it under that company, and posting a later job for the same company without one gets it filled in automatically — so a company only needs to be looked up on Glassdoor once, ever. The **Companies** tab reads from this same cache and shows a company's Glassdoor rating there too, even if that company currently has no tracked job listing.

Every company that shows up in the Jobs tab is also automatically added to the Companies tab (name and location only — existing companies, and any contacts/notes/interest level you've already added, are never overwritten). That keeps **Companies** as the one place with every company you've come across plus its Glassdoor reputation, whether or not you've curated it by hand.

Listings are gathered as a manual research pass: an AI assistant (or you, by hand) browses LinkedIn job search results and Glassdoor company pages in your own already-logged-in browser session — the same way you'd browse them yourself — then POSTs the gathered entries into this app's API. It's a one-off/periodic pull, not a live sync: nothing here polls LinkedIn automatically, and no automated bulk scraping is performed. Re-run the research pass whenever you want fresh listings.

This can't be automated via a button in the app or a scheduled job — LinkedIn blocks unauthenticated server-side requests to its search endpoints outright, and a scheduled/cloud agent has no access to your logged-in browser session either. The only thing that works is a live AI coding session (e.g. Claude Code) driving your actual browser, triggered by you when you want a refresh.

### Configuring your search

What to search for lives in `job-search.json` at the repo root. It's gitignored, so each person keeps their own. Start from the committed template:

```bash
cp job-search.example.json job-search.json
```

Then edit the role, levels, keywords, locations and excluded employers. The app serves the file at `GET /api/search-config` and uses it for the level dropdowns. It falls back to the example file if you haven't made your own. If the file is missing when you run the skill below, Claude asks you for the basics and writes it for you.

**A Claude Code skill is what actually does the gathering.** It's checked into this repo at `.claude/skills/update-jobs/SKILL.md`, so it's available to anyone who clones the repo and opens it in Claude Code — no setup beyond having the browser-automation tool (Claude in Chrome) connected. To use it, ask Claude to update/refresh the job list; it will:

1. Browse your LinkedIn "Jobs that match your profile" feed *and* run each keyword search from `job-search.json`. The feed alone misses variant titles like "Tech Lead", and the keyword searches alone under-surface levels below your current title, so both are needed.
2. Filter to the configured levels and locations (remote in `remote_regions`, or hybrid/onsite in `onsite_cities`), skipping `exclude_employers` and the posting types in `exclude_postings`.
3. Deduplicate against what's already in the Jobs tab (by LinkedIn job ID).
4. Look up each new company's Glassdoor rating (or copy it from an existing entry at the same company) and add the listing via the API.

See the skill file itself for the exact method, selectors, and edge cases it's already learned to handle.

## Project structure

```
interview-progress-tracker/
├── app.py               # Flask backend (REST API)
├── storage.py           # SQLite persistence
├── data/
│   ├── tracker.db        # Persisted mutable data (auto-created, gitignored)
│   └── *.json            # Read-only catalogs and legacy import files
├── static/
│   ├── app.js           # Frontend logic
│   └── style.css        # Styles
├── templates/
│   └── index.html       # HTML layout
├── tests/               # API tests; tests/e2e has the Playwright UI tests
└── docs/quality-plan.html  # How the project is tested and checked
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the checks CI runs. In short:

```bash
pip install -r requirements-dev.txt
playwright install chromium
pre-commit install   # lint and format on every commit
pytest               # API + UI tests, with backend and frontend coverage gates
```

Tests never touch your real data: every test gets its own temporary database,
and the run aborts if anything opens a database inside the repo.
