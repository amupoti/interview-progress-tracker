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

Then open **http://localhost:5000** in your browser.

Mutable data is automatically saved to the local SQLite database at `data/tracker.db`.
Existing JSON data is imported automatically the first time each data set is accessed.

## Features

- Add, edit, and delete job applications
- Track status across 8 stages: `Applied → Phone Screen → Technical → On-site → Offer → Accepted / Rejected / Declined`
- Upcoming interviews panel (next 7 days)
- Sort by any column
- Filter by company name, role, or status

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
