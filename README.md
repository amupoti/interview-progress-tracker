# Interview Progress Tracker

A lightweight web app to track your software engineering job applications — built with Python/Flask and vanilla JS.

## Requirements

- Python 3.8+
- Flask

## Setup

```bash
# 1. Install Flask
pip3 install flask

# 2. Run the app
python3 app.py
```

Then open **http://localhost:5001** in your browser.

> **Note (macOS):** port 5000 is used by AirPlay Receiver on modern macOS, which returns
> a `403 Forbidden` for unrelated requests — that's why this app defaults to 5001.

Mutable data is automatically saved to the local SQLite database at `data/tracker.db`.
Existing JSON data is imported automatically the first time each data set is accessed.

## Features

- Add, edit, and delete job applications
- Track status across 8 stages: `Applied → Phone Screen → Technical → On-site → Offer → Accepted / Rejected / Declined`
- Upcoming interviews panel (next 7 days)
- Sort by any column
- Filter by company name, role, or status
- **Jobs tab** — track candidate listings you're still deciding on (see below) before they become full applications

## Fields tracked per application

| Field | Description |
|---|---|
| Company Name | Name of the company |
| Job Title | Role you applied for |
| Status | Current stage in the process |
| Application Date | When you applied (defaults to today) |
| Next Interview Date | Upcoming interview date |
| Interviews Completed | How many rounds done so far |
| Salary Min / Max | Expected salary range |
| Remote Days / Week | Days of remote work (0–5) |
| Location | City, country |
| Tech Stack | Technologies involved |
| Interest Level | Your priority (1–5 stars) |
| Offer Deadline | When the offer expires |
| Contact Name / Email | Recruiter or hiring manager |
| Job Posting URL | Link to the original listing |
| Notes | Freeform notes, feedback, prep reminders |

## Jobs tab

The Jobs tab is a lightweight triage list for job listings you've found but haven't decided to apply to yet — a staging area that sits before the Applications tab. Add, edit, and delete entries the same way as Applications.

**Fields tracked per job**

| Field | Description |
|---|---|
| Company | Name of the company |
| Job Title | Role as listed |
| Location | City/country as listed |
| Work Mode | `Remote`, `Hybrid`, or `Onsite` |
| Level | `Senior`, `Staff`, or `Other` |
| Link | URL to the original listing |
| Glassdoor Rating | 0–5 stars |
| Glassdoor Notes | Review highlights, red flags, sample size caveats, etc. |
| Status | `Pending` (default) → `Interested` → `Applied` → `Interviewing` → `Offer` / `Rejected` / `Discarded` |
| Date Added | Defaults to today |
| Notes | Freeform notes |

**Filtering and sorting**

- Filter by work mode (Remote / Hybrid / Onsite), by level (Senior / Staff / Other), or free-text search across company, title, location, level, and notes.
- Click any column header to sort by it.
- With no column sort active, rows default-sort with **referral-aware ranking**: any job at a company that has a contact listed in the **Companies** tab floats to the top, with Glassdoor rating as the tiebreaker. Add a contact name to a company in the Companies tab and its open roles automatically jump to the top of the Jobs list.

New listings land in the `Pending` status so you can review them in bulk and manually promote the ones worth pursuing to `Interested`.

### How the LinkedIn/Glassdoor data gets in

There is no LinkedIn or Glassdoor API integration, no stored credentials, and no background scraping job. The app itself only exposes a REST API (`GET/POST /api/jobs`, `PUT/DELETE /api/jobs/<id>`) for whatever job data you give it.

Listings are gathered as a manual research pass: an AI assistant (or you, by hand) browses LinkedIn job search results and Glassdoor company pages in your own already-logged-in browser session — the same way you'd browse them yourself — then POSTs the gathered entries into this app's API. It's a one-off/periodic pull, not a live sync: nothing here polls LinkedIn automatically, and no automated bulk scraping is performed. Re-run the research pass whenever you want fresh listings.

## Project structure

```
interviewProgress/
├── app.py               # Flask backend (REST API)
├── data/
│   ├── tracker.db        # Persisted mutable data (auto-created)
│   └── *.json            # Read-only catalogs and legacy import files
├── static/
│   ├── app.js           # Frontend logic
│   └── style.css        # Styles
└── templates/
    └── index.html       # HTML layout
```
