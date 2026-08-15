#!/bin/bash
# MOVE_TO_ARCHIVES.sh
# Run this from the root of the gravity-blog repo (in terminal, or via
# github.dev's built-in terminal: Ctrl+` / Cmd+`).
#
# This moves loose backup/duplicate files at the repo root into
# 16_ARCHIVES/, preserving git history (git mv, not rm + add).
#
# ⚠️ Two filenames below were truncated in the GitHub file listing.
# Before running, confirm the exact names with:
#   ls -la | grep -i backup
# and edit the paths below if they differ.

set -e  # stop on first error

mkdir -p 16_ARCHIVES/root-backups

# 1. admin.html.backup
if [ -f "admin.html.backup" ]; then
  git mv admin.html.backup 16_ARCHIVES/root-backups/admin.html.backup
  echo "Moved: admin.html.backup"
fi

# 2. backup-before-delete... (CONFIRM EXACT NAME FIRST — see note above)
#    Example if the full name is backup-before-delete-2025-08-01.html:
# git mv "backup-before-delete-2025-08-01.html" "16_ARCHIVES/root-backups/backup-before-delete-2025-08-01.html"

# 3. Duplicate Thai-named status file — CONFIRM which is current first.
#    Example if the file is PROJECT-STATUS_สรุป.md:
# git mv "PROJECT-STATUS_สรุป.md" "16_ARCHIVES/root-backups/PROJECT-STATUS_สรุป.md"

echo ""
echo "Done with the confirmed moves. Uncomment and fix the remaining two"
echo "lines above once you've confirmed the exact filenames, then re-run."
echo ""
echo "After moving files, update 16_ARCHIVES/INDEX.md with the real dates,"
echo "then commit:"
echo "  git add -A"
echo "  git commit -m \"chore: archive loose backup/duplicate files from root\""
echo "  git push"
