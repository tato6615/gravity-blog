[PROJECT_INDEX.md](https://github.com/user-attachments/files/31094021/PROJECT_INDEX.md)
# PROJECT_INDEX.md
### Central navigation for GRAVITY OS — the single source of truth for this project.

> If you are an AI agent (Claude, GPT, or future agent) starting work on this
> project, read this file first. It tells you where everything lives and why.

---

## How this project is organized

Every piece of information has exactly one home. Do not create duplicate
files, `_v2`, `_final`, or `_temp` versions — extend the existing structure
or archive the old version (`16_ARCHIVES`) instead.

| # | Folder | What lives here |
|---|---|---|
| 00 | [`00_VISION`](./00_VISION) | Why this project exists, long-term direction |
| 01 | [`01_ARCHITECTURE`](./01_ARCHITECTURE) | System architecture, file structure, technical design |
| 02 | [`02_SYSTEMS`](./02_SYSTEMS) | Documentation for each major subsystem |
| 03 | [`03_PLAYBOOKS`](./03_PLAYBOOKS) | Step-by-step how-to procedures (deploy, etc.) |
| 04 | [`04_BUG_DATABASE`](./04_BUG_DATABASE) | Known bugs, tracked issues |
| 05 | [`05_ROADMAP`](./05_ROADMAP) | Scoped, prioritized, scheduled work (backlog) |
| 06 | [`06_ASSETS`](./06_ASSETS) | Brand, media, mockups, marketing graphics |
| 07 | [`07_IDEAS`](./07_IDEAS) | Raw, unscored ideas — the inbox before the roadmap |
| 08 | [`08_DEVELOPMENT_RULES`](./08_DEVELOPMENT_RULES) | Coding standards, conventions, dev rules |
| 09 | [`09_SECURITY`](./09_SECURITY) | Security posture, credentials status (never actual secrets) |
| 10 | [`10_OPERATIONS`](./10_OPERATIONS) | Deployment log, incidents, maintenance, runbooks |
| 11 | [`11_DECISIONS`](./11_DECISIONS) | Decision log (ADRs) — the "why" behind key choices |
| 12 | [`12_AI_CONTEXT`](./12_AI_CONTEXT) | Onboarding docs written specifically for AI agents |
| 13 | [`13_DATA`](./13_DATA) | Data schema, models, data flow |
| 14 | [`14_API`](./14_API) | API documentation, environment variables |
| 15 | [`15_INTEGRATIONS`](./15_INTEGRATIONS) | Third-party services and external dependencies |
| 16 | [`16_ARCHIVES`](./16_ARCHIVES) | Retired, superseded, or backup files — nothing is deleted, it's archived |

---

## Quick paths for common tasks

**"I need to understand what this project is."**
→ Start at `00_VISION`, then `01_ARCHITECTURE`.

**"I need to fix a bug."**
→ Check `04_BUG_DATABASE` first, then relevant folder in `02_SYSTEMS`.

**"I need to deploy."**
→ `03_PLAYBOOKS/DEPLOY.md`, and log the result in `10_OPERATIONS/DEPLOYMENTS.md`.

**"I have an idea for a feature."**
→ Drop it in `07_IDEAS/INBOX.md`. Do not add it directly to the roadmap.

**"I need to know why something was built a certain way."**
→ Check `11_DECISIONS` before asking or redesigning.

**"I'm an AI agent picking up this project cold."**
→ Read `12_AI_CONTEXT` in full before making any changes.

**"I found a stray/duplicate/backup file at the project root."**
→ It shouldn't be there. Move it to `16_ARCHIVES` and log it in
  `16_ARCHIVES/INDEX.md`. Never delete it outright.

---

## Root-level files (outside numbered folders)

| File | Purpose |
|---|---|
| `README.md` | Public-facing project overview |
| `PROJECT_INDEX.md` | This file — central navigation |
| `PROJECT-STATUS.md` | Current status snapshot |
| `.gitignore` | Git ignore rules |

If you see other loose files at root (backups, duplicates, `_old` files),
that's a sign cleanup is overdue — check `16_ARCHIVES/INDEX.md`.

---

## Core rules (do not violate)

1. Every piece of information must have a home — use the table above.
2. Documentation ≠ journals. Bugs ≠ roadmap. Ideas ≠ tasks.
3. No `V2`, `FINAL`, `NEW`, `TEMP` files — extend or archive instead.
4. Nothing gets silently deleted — archive it with a reason.
5. Single Source of Truth — if two files say the same thing, one of them
   is wrong or stale. Fix it immediately.

---

*Last updated: reflects all 16 folders present as of this commit.*
