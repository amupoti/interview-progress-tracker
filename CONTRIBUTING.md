# Contributing

## Setup

Python 3.10+ is required.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
playwright install chromium
pre-commit install
```

## Checks

CI runs the same checks on every pull request. All of them must pass before
merging into `main`.

| Check | Command | What it does |
|---|---|---|
| Lint and format | `pre-commit run --all-files` | ruff (Python), Biome (JS/CSS), djlint (template), file hygiene |
| Tests | `pytest` | API tests and Playwright UI tests |
| Backend coverage | part of `pytest` | Fails below 98% branch coverage of `app.py` and `storage.py` |
| Frontend coverage | part of `pytest` | Fails below 95% line coverage of `static/app.js` |
| Dependencies | `pip-audit -r requirements-dev.txt` | Fails on known vulnerabilities |
| Security scan | CodeQL (CI only) | Python, JavaScript and workflow files |

Run only the fast API tests with `pytest --ignore=tests/e2e`. Note that the
coverage gates apply to whatever you run, so a partial run may report a gate
failure even when every test passes.

## Writing tests

- API tests go in `tests/test_app.py` and use the `client` fixture.
- UI tests go in `tests/e2e/`. Seed data with `seed_job(...)` or `api`, then
  open the page with `open_app()`. Prefer `expect(...)` assertions, which wait,
  over reading values directly.
- A known bug gets a test marked `@pytest.mark.xfail(strict=True, reason=...)`,
  so the test fails as a reminder once the bug is fixed.

## Formatting

The one-time reformat is listed in `.git-blame-ignore-revs`. To have local
`git blame` skip it:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```
