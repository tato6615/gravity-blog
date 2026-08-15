[README.md](https://github.com/user-attachments/files/31093909/README.md)
# 10_OPERATIONS

## Purpose
Day-to-day running of the live product: deployment records, monitoring,
incident response, and recurring operational tasks. This is distinct from
`03_PLAYBOOKS` (how-to procedures) and `09_SECURITY` (security posture) —
this folder is the operational *log and runbook* for keeping the system alive.

## What belongs here
- Deployment history / release notes (what shipped, when, by whom)
- Incident reports (what broke, impact, root cause, fix, follow-up)
- Monitoring & alerting setup notes
- Recurring maintenance tasks (backups, renewals, cleanups) and their cadence
- On-call / "if X breaks, do Y" runbooks specific to production operations

## What does NOT belong here
- Step-by-step how-to guides for development tasks → `03_PLAYBOOKS`
- Security policy, credentials status, threat notes → `09_SECURITY`
- Bug tracking → `04_BUG_DATABASE`

## Structure
```
10_OPERATIONS/
  DEPLOYMENTS.md      → chronological log of releases
  INCIDENTS/           → one file per incident, dated
  MAINTENANCE.md       → recurring tasks + cadence (daily/weekly/monthly)
  RUNBOOKS/             → "if X happens, do Y" production runbooks
```

## Status
🟡 Newly created — needs first entries migrated in (e.g. from PROJECT-STATUS.md
or deployment history already in the repo).
