[README.md](https://github.com/user-attachments/files/31093897/README.md)
# 15_INTEGRATIONS

## Purpose
A registry of every external service, API, or third-party tool the project
depends on — what it's used for, how it's connected, and what breaks if it
goes down. This is distinct from `14_API` (your own API surface) — this
folder is about *outbound* dependencies on other people's systems.

## What belongs here
One file per integration:

```md
# <Service Name>

## Purpose
What this integration is used for and why it was chosen.

## Where it's used
Which parts of the codebase / which features depend on it.

## Auth
Where credentials live (reference only — never the actual secret; see
09_SECURITY for credential status).

## Failure mode
What breaks, and how visibly, if this service goes down or changes its API.

## Docs
Link to the service's own documentation.
```

## What does NOT belong here
- Your own API documentation → `14_API`
- Actual API keys/secrets → environment variables, referenced (not stored)
  in `09_SECURITY`

## Structure
```
15_INTEGRATIONS/
  <service-name>.md   → one file per external service
  INDEX.md              → flat list of all integrations, at a glance
```

## Status
🟡 Newly created — needs current integrations documented (e.g. any email
API, hosting/deploy service, analytics, third-party auth already in use).
