"""Line coverage for static/app.js, collected from Chromium during the UI tests.

Each page records V8's precise coverage over the Chrome DevTools Protocol.
Results are merged across tests, reported next to pytest-cov's table, written
to coverage-js.lcov, and checked against --js-cov-fail-under.
"""

import os
import re
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).parent.parent
SCRIPT = ROOT_DIR / "static" / "app.js"
SCRIPT_URL_SUFFIX = "/static/app.js"
LCOV_FILE = ROOT_DIR / "coverage-js.lcov"
COMMENT_LINE = re.compile(r"^\s*(//|/\*|\*)")


class JsCoverage:
    def __init__(self):
        self.source = SCRIPT.read_text()
        # V8 reports offsets in UTF-16 code units, and app.js has emoji.
        self.covered = bytearray(utf16_len(self.source))
        self.collected = False

    def start(self, page):
        cdp = page.context.new_cdp_session(page)
        cdp.send("Profiler.enable")
        cdp.send("Profiler.startPreciseCoverage", {"callCount": True, "detailed": True})
        return cdp

    def stop(self, cdp):
        try:
            result = cdp.send("Profiler.takePreciseCoverage")["result"]
        except Exception:
            return  # page already closed
        for script in result:
            if script["url"].endswith(SCRIPT_URL_SUFFIX):
                self._merge(script["functions"])

    def _merge(self, functions):
        # Ranges nest; apply outer ranges first so inner block counts win.
        ranges = [r for fn in functions for r in fn["ranges"]]
        ranges.sort(key=lambda r: (r["startOffset"], -r["endOffset"]))
        counts = [0] * len(self.covered)
        for r in ranges:
            end = min(r["endOffset"], len(counts))
            counts[r["startOffset"] : end] = [r["count"]] * (end - r["startOffset"])
        for i, count in enumerate(counts):
            if count:
                self.covered[i] = 1
        self.collected = True

    def lines(self):
        """(line number, covered) for every line with code on it."""
        offset = 0
        for number, line in enumerate(self.source.split("\n"), start=1):
            stripped = line.strip()
            if stripped and not COMMENT_LINE.match(line):
                first_char = offset + utf16_len(line) - utf16_len(line.lstrip())
                yield number, bool(self.covered[first_char])
            offset += utf16_len(line) + 1

    def percent(self):
        lines = list(self.lines())
        return 100 * sum(c for _, c in lines) / len(lines), lines

    def write_lcov(self, lines):
        hit = sum(c for _, c in lines)
        body = "".join(f"DA:{n},{int(c)}\n" for n, c in lines)
        LCOV_FILE.write_text(f"TN:\nSF:{SCRIPT}\n{body}LF:{len(lines)}\nLH:{hit}\nend_of_record\n")


def utf16_len(text):
    return len(text.encode("utf-16-le")) // 2


def missing_ranges(lines):
    ranges, start, prev = [], None, None
    for number, covered in lines:
        if not covered:
            start = number if start is None else start
            prev = number
        elif start is not None:
            ranges.append(f"{start}-{prev}" if start != prev else str(start))
            start = None
    if start is not None:
        ranges.append(f"{start}-{prev}" if start != prev else str(start))
    return ", ".join(ranges)


_coverage = JsCoverage()


def pytest_addoption(parser):
    parser.addoption(
        "--js-cov-fail-under",
        type=float,
        default=0,
        help="Fail if static/app.js line coverage from UI tests is below this percentage.",
    )


@pytest.fixture(scope="session")
def js_coverage():
    return _coverage


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    if not _coverage.collected:
        return
    percent, lines = _coverage.percent()
    _coverage.write_lcov(lines)
    hit = sum(c for _, c in lines)
    tr = terminalreporter
    tr.section("frontend coverage")
    tr.write_line(f"{'Name':<16}{'Lines':>7}{'Miss':>7}{'Cover':>8}   Missing")
    tr.write_line("-" * 56)
    tr.write_line(
        f"{'static/app.js':<16}{len(lines):>7}{len(lines) - hit:>7}{percent:>7.0f}%   {missing_ranges(lines)}"
    )
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write("| Frontend | Lines | Miss | Cover |\n|---|--:|--:|--:|\n")
            f.write(f"| static/app.js | {len(lines)} | {len(lines) - hit} | {percent:.0f}% |\n\n")
    threshold = config.getoption("--js-cov-fail-under")
    if threshold:
        if percent < threshold:
            tr.write_line(
                f"FAIL Required frontend coverage of {threshold:g}% not reached. Total: {percent:.2f}%", red=True
            )
        else:
            tr.write_line(f"Required frontend coverage of {threshold:g}% reached. Total: {percent:.2f}%")


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    threshold = session.config.getoption("--js-cov-fail-under")
    if threshold and _coverage.collected and exitstatus == 0 and _coverage.percent()[0] < threshold:
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
