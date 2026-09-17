---
name: update-jobs
description: Gather new Senior/Staff Software Engineer listings from LinkedIn and add them to this app's Jobs tab. Use when the user asks to refresh, reload, or update the job list/search, or add new LinkedIn listings.
---

# Update Jobs

Gathers new job listings for the user's Staff Software Engineer job search (Barcelona / remote Spain) and adds them to this app's Jobs tab. This can **only** be done by driving the user's real logged-in Chrome session through the Claude in Chrome tool — there is no way to automate this via the app's backend or a scheduled cloud routine (both are blocked; see "Why this can't be automated" below). Every run of this skill must be triggered live, in a session with Chrome connected.

## Search scope

- **Levels:** Senior or Staff only (or clear equivalents like "Engineering Lead", "Tech Lead", "Staff Engineer"). Explicitly **exclude Principal-level** roles.
- **Location:** Remote roles anywhere in Spain/EMEA/EU/EEA, OR Hybrid/Onsite roles specifically in Barcelona. Hybrid/onsite roles outside Barcelona (Madrid, Zaragoza, etc.) are out of scope.
- **Exclude:** relocation-required postings (e.g. "Bangkok based, relocation provided"), freelance/temporary/hourly-contract postings, staffing-agency/recruiter reposts that obscure the real employer (names like "X Consultants", "X Staffing", "X People Ltd", "Jobgether", "Hire Feed"), generalist IT consultancies/body-shops even when posting under their own name (NTT DATA, GFT Technologies, Indra Group, ALTEN, Robert Walters, K2 Partnering Solutions, Lawrence Harvey, etc. — the actual work is typically client placement, not a genuine product-company IC role), and roles clearly outside core software engineering (e.g. embedded firmware) unless the domain overlaps the user's background (distributed systems/backend).

## Steps

1. **Load browser tools** if not already loaded: `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp")`.

2. **Get current jobs for dedup.** Start the local app if not running (`cd` into the repo, `(python3 app.py > /tmp/tracker_app.log 2>&1 &)`, port 5001), then `GET http://localhost:5001/api/jobs`. Build a set of already-tracked LinkedIn job ids by parsing the numeric id out of each `link` (`/jobs/view/<id>/`) — dedupe on this id, not company name, since companies can have multiple distinct tracked roles.

3. **Gather candidates from two sources, every pass** (neither alone is thorough — confirmed by experience: keyword search misses title variants like "Engineering Lead"; the personalized feed likely under-surfaces Senior roles since LinkedIn's algorithm weighs the user's current Staff-level title):
   - Browse the user's personalized feed: navigate to `https://www.linkedin.com/jobs/collections/recommended/` (or the "Jobs" home) in the user's logged-in session.
   - Also run an explicit keyword search for Senior specifically: `https://www.linkedin.com/jobs/search/?keywords=%22Senior%20Software%20Engineer%22&location=Spain&sortBy=DD` (and Staff if useful: `%22Staff%20Software%20Engineer%22`).
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

6. **Add each qualifying new listing** via `POST http://localhost:5001/api/jobs` with: `company`, `title`, `location` (as shown on LinkedIn, e.g. "Barcelona, Catalonia, Spain (Remote)"), `work_mode` (`Remote`/`Hybrid`/`Onsite`, parsed from the location suffix), `level` (`Senior`/`Staff`), `link` (the `/jobs/view/<id>/` URL), `glassdoor_rating`, `glassdoor_notes` (omit both if reusing a cached value — the backend fills them in from the cache), `status: "Pending"`, `date_added` (today, ISO format). Do this via a small Python script using `urllib.request` (see prior conversation for the exact pattern) rather than one curl call per job. Posting a job that *does* include a `glassdoor_rating` writes/refreshes that company's cache entry automatically.

7. **Stop the local Flask server** when done (`pkill -f "python3 app.py"`) and close any browser tabs opened for this task.

8. **Report back**: total new listings added, level breakdown (Senior/Staff), and any listings intentionally skipped that the user might expect to see (agency reposts, relocation-required, out-of-scope locations) so they can sanity-check the filtering.

## Why this can't be automated

- The app's own backend cannot fetch LinkedIn directly — tested and confirmed blocked (HTTP 429 + bot-detection challenge page on the very first unauthenticated request to LinkedIn's job-search endpoint).
- A scheduled cloud routine (`/schedule`, `RemoteTrigger`) cannot do this either — cloud agents run in an isolated sandbox with no access to the user's local machine or browser session, so they'd hit the identical block.
- The only thing that works is a real, live, logged-in browser session (via the Claude in Chrome tool), which only exists during an interactive session. Don't suggest scraping workarounds (spoofed headers, proxies) — the user does not want anti-bot-detection evasion attempted.
- If the user wants unattended automation without asking each time, the only legitimate alternative discussed is wiring the app to a real job-aggregator API (Adzuna or Jooble) instead of LinkedIn — offered once, not yet adopted.
