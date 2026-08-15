# 16_ARCHIVES

## Purpose
The one approved place for anything retired, superseded, or backed up.
This exists so that Objective #9 ("No V2, FINAL, NEW, TEMP files") can be
enforced everywhere *else* in the project — instead of leaving old versions
scattered at the root, they move here with context on why they were
archived and when.

## What belongs here
- Deprecated docs that were replaced by a newer version (keep both, but the
  old one lives here, not next to the current one)
- Old backup files (`*.backup`, `backup-before-*`, etc.) that were sitting
  loose in the repo root
- Retired systems/features that are no longer active but worth keeping a
  record of
- Superseded duplicate files (e.g. two versions of the same status doc)

## Rule
Nothing gets silently deleted — it gets moved here with a one-line reason.
Nothing in active folders (root, `00_VISION` through `15_INTEGRATIONS`)
should ever have a `.backup`, `-old`, `-copy`, `_v2`, or similar suffix —
if it needs to exist, it belongs here instead.

## Structure
```
16_ARCHIVES/
  INDEX.md            → what's archived, when, and why
  <original-path>/     → mirrors the original location, so context isn't lost
```

## ⚠️ Action needed right now
The repo root currently has files that violate Objective #9 and should be
moved here:
- `admin.html.backup`
- `backup-before-delete...` (full name truncated in listing — check repo)
- Possible duplicate: `PROJECT-STATUS.md` vs `PROJECT-STATUS_ส...` (Thai-named
  file) — confirm which is current, archive the other

## Status
🟡 Newly created — first cleanup pass pending (see above).
