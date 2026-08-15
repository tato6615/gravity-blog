[README.md](https://github.com/user-attachments/files/31093901/README.md)
# 11_DECISIONS

## Purpose
A permanent, append-only log of significant decisions and *why* they were
made — architecture choices, tooling choices, product direction changes,
anything a future AI agent (or future-you) would otherwise have to
re-derive or guess. This is the project's memory of "why," not just "what."

This is what lets an AI agent avoid re-litigating settled decisions or
re-proposing something you already tried and rejected.

## What belongs here
- Architecture Decision Records (ADRs) — see template below
- Reversed decisions, and why they were reversed
- Explicitly rejected alternatives, and why

## Format — one file per decision
`DECISIONS/YYYY-MM-DD_short-title.md`

```md
# Decision: <short title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by <link>

## Context
What problem or question forced this decision?

## Decision
What was decided, in one or two sentences.

## Alternatives considered
- Option A — why rejected
- Option B — why rejected

## Consequences
What this makes easier, harder, or forecloses going forward.
```

## Rule
Never delete a decision file, even if superseded — mark it `Superseded by`
and link forward. Deleting decisions destroys the project's memory and is
exactly what causes future AI agents (and future-you) to re-litigate settled
questions.

## Status
🟡 Newly created — needs first decisions logged (start with anything already
decided in VISION/ARCHITECTURE that isn't explained elsewhere).
