---
name: update-jobs
description: Gather new Senior/Staff Software Engineer listings from LinkedIn and add them to this app's Jobs tab. Use when the user asks to refresh, reload, or update the job list/search, or add new LinkedIn listings.
---

# Update Jobs

Gathers new job listings for the user's Staff Software Engineer job search (Barcelona / remote Spain) and adds them to this app's Jobs tab. This can **only** be done by driving the user's real logged-in Chrome session through the Claude in Chrome tool — there is no way to automate this via the app's backend or a scheduled cloud routine (both are blocked; see "Why this can't be automated" below). Every run of this skill must be triggered live, in a session with Chrome connected.

## Search scope

- **Levels:** Senior or Staff only (or clear equivalents like "Engineering Lead", "Tech Lead", "Staff Engineer"). Explicitly **exclude Principal-level** roles.
- **Location:** Remote roles anywhere in Spain/EMEA/EU/EEA, OR Hybrid/Onsite roles specifically in Barcelona. Hybrid/onsite roles outside Barcelona (Madrid, Zaragoza, etc.) are out of scope.
- **Exclude:** any listing from a company flagged `excluded` in the Companies tab (skip it entirely — don't add it; the backend would auto-discard it anyway), relocation-required postings (e.g. "Bangkok based, relocation provided"), freelance/temporary/hourly-contract postings, staffing-agency/recruiter reposts that obscure the real employer (names like "X Consultants", "X Staffing", "X People Ltd", "Jobgether", "Hire Feed"), generalist IT consultancies/body-shops even when posting under their own name (NTT DATA, GFT Technologies, Indra Group, ALTEN, Robert Walters, K2 Partnering Solutions, Lawrence Harvey, etc. — the actual work is typically client placement, not a genuine product-company IC role), and roles clearly outside core software engineering (e.g. embedded firmware) unless the domain overlaps the user's background (distributed systems/backend).

## Steps

1. **Load browser tools** if not already loaded: `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp")`.

2. **Get current jobs for dedup.** Start the local app if not running (`cd` into the repo, `(python3 app.py > /tmp/tracker_app.log 2>&1 &)`, port 5001), then `GET http://localhost:5001/api/jobs`. Build a set of already-tracked LinkedIn job ids by parsing the numeric id out of each `link` (`/jobs/view/<id>/`) — dedupe on this id, not company name, since companies can have multiple distinct tracked roles. Also `GET http://localhost:5001/api/companies` and collect the names of companies with `excluded: true` (compare lowercased/trimmed) — the user has said they don't want to work there.

3. **Gather candidates from two sources, every pass** (neither alone is thorough — confirmed by experience: keyword search misses title variants like "Engineering Lead"; the personalized feed likely under-surfaces Senior roles since LinkedIn's algorithm weighs the user's current Staff-level title):
   - Browse the user's personalized feed: navigate to `https://www.linkedin.com/jobs/collections/recommended/` (or the "Jobs" home) in the user's logged-in session.
   - Also run **all three** explicit exact-phrase keyword searches (`https://www.linkedin.com/jobs/search/?keywords=<phrase>&location=Spain&sortBy=DD`), every pass:
     - `%22Senior%20Software%20Engineer%22`
     - `%22Staff%20Software%20Engineer%22`
     - `%22Staff%20Engineer%22` — needed because quoted phrases only match exact wording: a job titled plain "Staff Engineer" (e.g. dLocal, Barcelona) never shows up under "Staff Software Engineer" (confirmed).
   - For each source, page through **multiple pages** (don't stop at page 1 — thin results on page 1 undercount badly). Click through page numbers at the bottom of the results list.
   - On each page, the results list is virtualized — scroll down within the list (`computer` scroll action at the list's coordinates, a couple of times with short waits) to force all cards to render before extracting.
   - Extract structured data with `javascript_tool`:
     ```js
     Array.from(document.querySelectorAll('li[data-occludable-job-id]')).map(el => {
       const link = el.querySelector('a[href*="/jobs/view/"]');
       const idMatch = link && link.href.match(/\/jobs\/view\/(\d+)/);
       return {
         id: idMatch ? idMatch[1] : null,
         href: link ? link.href.split('?')[0] : null,
         text: el.innerText.replace(/\n+/g, ' | ').trim()
       };
     }).filter(x => x.href);
     ```

4. **Filter** each candidate against the search scope above and against the dedup set from step 2. Use judgment on ambiguous cases (agency names, dual-level titles like "Senior/Staff") — note the assumption made when adding.

5. **Get Glassdoor data for each new listing.** The app caches Glassdoor lookups by company (keyed lowercase) in a `glassdoor_cache` store, since ratings rarely change — check it before scraping anything:
   - Fetch the cache once per run: `GET http://localhost:5001/api/glassdoor-cache` → `{"<company lowercase>": {"glassdoor_rating": ..., "glassdoor_notes": ..., "updated_at": ...}, ...}`.
   - If the company (case-insensitive) is in that cache, reuse its `glassdoor_rating`/`glassdoor_notes` — no need to re-search, and no need to pass them again when creating the job (step 6 auto-fills from the cache server-side if you omit them).
   - Otherwise, navigate to `https://www.glassdoor.com/Search/results.htm?keyword=<company name>` (no login needed) and read `document.querySelector('main').innerText` — the first "Companies" result gives rating + review count directly, e.g. `Company | 4.2★ | 39jobs | 365reviews`.
   - Format the note as `"<rating>★ from <count> reviews."`, appending `" (small sample)"` if review count < 30, or `" — solid sample size"` if > 200.
   - Some small/new companies have no Glassdoor presence at all — leave `glassdoor_rating`/`glassdoor_notes` blank rather than guessing (don't force a match to an unrelated same-named company). Blank results aren't cached, so they'll be retried next run.
   - **Do this inline for every job as you add it, not as an afterthought** — skipping it on a whole batch and backfilling later has already happened once and needed a follow-up correction.

5b. **Score each new listing against the user's CV.** Score in bulk, without opening each job page.
   - **Find the CV.** It lives in `data/`, is gitignored, and the file name changes between versions, so don't hardcode it. List `data/*.pdf` (then `*.docx`/`*.doc`). If there are several, prefer names containing "cv" or "resume" (case-insensitive), then the most recently modified. Read it with the Read tool once per run. If no CV is found, stop and ask the user rather than scoring from memory.
   - **Derive the profile from the CV you just read**: primary languages/stack, seniority, domains, languages spoken. Don't rely on a remembered profile, since the CV may have been updated.
   - **Which jobs:** the new listings from step 4, **plus any already-tracked job with status `Pending` or `Interested` and no `match_score`** (backfill). Collect their LinkedIn ids.
   - **Fetch descriptions** from any linkedin.com tab (e.g. `https://www.linkedin.com/jobs/`) through the logged-in API. Run the loop sequentially with a ~1.5s gap. Start it without awaiting (`window.__run=(async()=>{...})()`) and poll `Object.keys(window.__t).length` with `computer` waits, because a single JS call times out at 45s:
     ```js
     const csrf=(document.cookie.match(/JSESSIONID="?([^";]+)/)||[])[1];
     const r=await fetch('/voyager/api/jobs/jobPostings/'+id+'?decorationId=com.linkedin.voyager.deco.jobs.web.shared.WebFullJobPosting-65',
       {headers:{'csrf-token':csrf,'x-restli-protocol-version':'2.0.0'}});
     const j=await r.json();
     window.__t[id]={title:j.title, state:j.jobState, closed:!!(j.applyingInfo&&j.applyingInfo.closed), loc:j.formattedLocation, text:(j.description&&j.description.text)||''};
     ```
     On a non-200 response, retry after 5s, then 10s. Don't use the guest endpoint `/jobs-guest/jobs/api/jobPosting/<id>`, which returns 429 after ~20 calls.
   - **`jobState` other than `LISTED`** (`SUSPENDED`/`CLOSED`), or `applyingInfo.closed`, means the listing is no longer accepting applications. Don't add new listings in that state (list them as skipped in the report). For backfilled jobs, still score them, and add "LinkedIn shows the listing as no longer active." to `match_notes`.
   - **Read the descriptions back.** `javascript_tool` output is capped at ~1000 chars, and posting the text to a local server was denied by auto mode. So condense each job in-page to ~400 chars and read the joined string in 980-char slices, ~15 slices per `browser_batch`. Each summary line holds:
     - the last 4 id digits, a state flag, the title and the location
     - stack/domain keyword tags: java, kotlin, scala, go (`/\bGo\b|golang/`, case-sensitive), python, ts/node, rust, c++, php, c#, spring, aws, gcp, k8s, kafka, payments, e-commerce, search/ranking, ML, frontend, mobile, freelance/contractor
     - the first two "N+ years" matches
     - a snippet around location/office-days/timezone/visa wording
     - ~200 chars starting at the first "Requirements / What you'll bring / You have / Qualifications / About you" heading

     If a job is borderline or its summary is ambiguous, slice its full `window.__t[id].text` instead. `DOMParser` and `<template>` `querySelector` return nothing on LinkedIn pages, so use string ops only.
   - Score 0–100 with this rubric: required skills/tech stack 40, seniority & scope 25, domain/industry 20, logistics (location, work mode, contract type, language) 15. Freelance/agency postings score low on logistics. Roles whose primary stack isn't in the CV score low on skills. Stacks and domains that are the CV's strengths score high. As of the 2026-09 CV those are Java/Spring/AWS backend, distributed systems, payments/e-commerce and search/ranking; re-check this against the current CV each run.
   - Set `match_score` (integer) and `match_notes` (one sentence: strongest fit + main gaps) on the job in the step 6 POST. If the listing's title on LinkedIn differs from the search card (e.g. it's now "Principal"), mention it in `match_notes`.
   - For backfilled jobs, `PUT /api/jobs/<id>` the **full** existing record with `match_score`/`match_notes` added. PUT replaces the record, so fetch each job from `GET /api/jobs` first.
   - Also fix `location` when it disagrees with `work_mode`. For example, LinkedIn tags a role "(On-site)" while the posting is hybrid. Keep the two consistent, and mention the LinkedIn tag in `match_notes` if it's misleading.

6. **Add each qualifying new listing** via `POST http://localhost:5001/api/jobs` with: `company`, `title`, `location` (as shown on LinkedIn, e.g. "Barcelona, Catalonia, Spain (Remote)"), `work_mode` (`Remote`/`Hybrid`/`Onsite`, parsed from the location suffix), `level` (`Senior`/`Staff`), `link` (the `/jobs/view/<id>/` URL), `glassdoor_rating`, `glassdoor_notes` (omit both if reusing a cached value — the backend fills them in from the cache), `match_score`, `match_notes` (from step 5b), `status: "Pending"`, `date_added` (today, ISO format). Do this via a small Python script using `urllib.request` (see prior conversation for the exact pattern) rather than one curl call per job. Posting a job that *does* include a `glassdoor_rating` writes/refreshes that company's cache entry automatically. The backend also auto-adds the company to the **Companies** tab if it's not already there (nothing to do here — no need to also `POST /api/companies` yourself).

7. **Close out listings that stopped accepting applications.** `POST http://localhost:5001/api/jobs/refresh` (takes a few minutes; it fetches every link with a 0.3s delay, so run it with a long timeout or in the background). It moves `Pending`/`Interested` jobs whose LinkedIn page says "No longer accepting applications" / "Not currently accepting applications" to `Closed`, and leaves jobs you've acted on (Applied, Interviewing, Offer, Rejected, Discarded) alone. It returns `{"checked": N, "closed": M}`.

8. **Restart the local Flask server** when done so the user is left with the app running: stop it (`pkill -f "app.py"` — the macOS process shows as `Python app.py`, so a `python3 app.py` pattern never matches), start it again (`(python3 app.py > /tmp/tracker_app.log 2>&1 &)`), and check `http://localhost:5001/` returns 200. Close any browser tabs opened for this task.
   - **Gotcha:** `PUT /api/jobs/<id>` replaces the whole record, it does not merge. To fix one field, send the full job object.

9. **Report back**: total new listings added (with their match scores, highest first), how many existing jobs were backfilled with a score in step 5b (plus any backfilled job scoring ≥ 65), how many listings were closed in step 7, level breakdown (Senior/Staff), and any listings intentionally skipped that the user might expect to see (excluded companies, agency reposts, relocation-required, out-of-scope locations) so they can sanity-check the filtering.

## Why this can't be automated

- The app's own backend cannot fetch LinkedIn directly — tested and confirmed blocked (HTTP 429 + bot-detection challenge page on the very first unauthenticated request to LinkedIn's job-search endpoint).
- A scheduled cloud routine (`/schedule`, `RemoteTrigger`) cannot do this either — cloud agents run in an isolated sandbox with no access to the user's local machine or browser session, so they'd hit the identical block.
- The only thing that works is a real, live, logged-in browser session (via the Claude in Chrome tool), which only exists during an interactive session. Don't suggest scraping workarounds (spoofed headers, proxies) — the user does not want anti-bot-detection evasion attempted.
- If the user wants unattended automation without asking each time, the only legitimate alternative discussed is wiring the app to a real job-aggregator API (Adzuna or Jooble) instead of LinkedIn — offered once, not yet adopted.
