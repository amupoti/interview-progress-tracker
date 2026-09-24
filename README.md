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
| Level | `Senior`, `Staff`, or `Other` |
| Link | URL to the original listing |
| Glassdoor Rating | 0–5 stars |
| Glassdoor Notes | Review highlights, red flags, sample size caveats, etc. |
| Status | `Pending` (default) → `Interested` → `Applied` → `Interviewing` → `Offer` / `Rejected` / `Discarded` |
| Date Added | Defaults to today |
| Next Interview Date / Type | Upcoming round (e.g. Recruiter Screen, Technical, On-site); feeds the Upcoming Interviews panel |
| Notes | Freeform notes |

**Filtering and sorting**

- Filter by work mode (Remote / Hybrid / Onsite), by level (Senior / Staff / Other), or free-text search across company, title, location, level, and notes.
- Click any column header to sort by it.
- With no column sort active, rows default-sort **by how far along the process they are**: `Offer` → `Interviewing` → `Applied` → `Interested` → `Pending`, then closed-out `Rejected` / `Discarded` / `Removed` at the bottom. Sorting by the Status column uses the same order.
- Within a status, **referral-aware ranking** applies: any job at a company that has a contact listed in the **Companies** tab floats to the top, with Glassdoor rating as the tiebreaker.

New listings land in the `Pending` status so you can review them in bulk and manually promote the ones worth pursuing to `Interested`.

Every status change is recorded with its date in the job's `status_history`, which is what the **Pipeline** tab charts. The **🔄 Reload Offers** button marks listings whose LinkedIn posting has closed as `Removed`, but only while they're still `Pending` or `Interested` — once you've applied, a closed posting doesn't touch the job.

### How the LinkedIn/Glassdoor data gets in

There is no LinkedIn or Glassdoor API integration, no stored credentials, and no background scraping job. The app itself only exposes a REST API (`GET/POST /api/jobs`, `PUT/DELETE /api/jobs/<id>`) for whatever job data you give it.

Glassdoor ratings are cached server-side by company (`GET /api/glassdoor-cache`), since they rarely change: posting a job with a `glassdoor_rating` stores it under that company, and posting a later job for the same company without one gets it filled in automatically — so a company only needs to be looked up on Glassdoor once, ever. The **Companies** tab reads from this same cache and shows a company's Glassdoor rating there too, even if that company currently has no tracked job listing.

Every company that shows up in the Jobs tab is also automatically added to the Companies tab (name and location only — existing companies, and any contacts/notes/interest level you've already added, are never overwritten). That keeps **Companies** as the one place with every company you've come across plus its Glassdoor reputation, whether or not you've curated it by hand.

Listings are gathered as a manual research pass: an AI assistant (or you, by hand) browses LinkedIn job search results and Glassdoor company pages in your own already-logged-in browser session — the same way you'd browse them yourself — then POSTs the gathered entries into this app's API. It's a one-off/periodic pull, not a live sync: nothing here polls LinkedIn automatically, and no automated bulk scraping is performed. Re-run the research pass whenever you want fresh listings.

This can't be automated via a button in the app or a scheduled job — LinkedIn blocks unauthenticated server-side requests to its search endpoints outright, and a scheduled/cloud agent has no access to your logged-in browser session either. The only thing that works is a live AI coding session (e.g. Claude Code) driving your actual browser, triggered by you when you want a refresh.

The **🔍 Search LinkedIn** button is a shortcut for browsing that search yourself: it opens a new tab straight to a LinkedIn job search prefilled with `"Senior Software Engineer" OR "Staff Software Engineer"` across Spain, sorted by most recent. It doesn't fetch or add anything itself.

**A Claude Code skill is what actually does the gathering.** It's checked into this repo at `.claude/skills/update-jobs/SKILL.md`, so it's available to anyone who clones the repo and opens it in Claude Code — no setup beyond having the browser-automation tool (Claude in Chrome) connected. To use it, ask Claude to update/refresh the job list; it will:

1. Browse your LinkedIn "Jobs that match your profile" feed *and* run an explicit "Senior Software Engineer" search — the feed alone misses variant titles like "Tech Lead" or "Architect", and the keyword search alone under-surfaces Senior roles once your title is Staff, so both are needed.
2. Filter to Senior/Staff roles that are remote-in-Spain or hybrid/onsite specifically in Barcelona, skipping relocation-required postings, contract/freelance gigs, staffing-agency reposts, and generalist IT consultancies.
3. Deduplicate against what's already in the Jobs tab (by LinkedIn job ID).
4. Look up each new company's Glassdoor rating (or copy it from an existing entry at the same company) and add the listing via the API.

See the skill file itself for the exact method, selectors, and edge cases it's already learned to handle.

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
