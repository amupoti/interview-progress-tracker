# Security policy

This is a personal, single-user app meant to run on `localhost`. It has no
authentication, so don't expose it to a network you don't trust.

## Reporting a vulnerability

Please report security issues privately through GitHub:
**Security → Report a vulnerability** on this repository. Don't open a public
issue. You'll get a reply within a week.

## What's checked automatically

- **CodeQL** scans Python, JavaScript and the workflow files on every pull
  request and weekly.
- **pip-audit** fails CI if a pinned dependency has a known vulnerability.
- **ruff** runs the bandit (`S`) security rules on every commit.
- **Dependabot** opens weekly pull requests for Python packages and
  GitHub Actions.
- **Secret scanning with push protection** is enabled on the repository.
