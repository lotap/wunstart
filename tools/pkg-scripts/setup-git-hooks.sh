#!/bin/sh
# Point git at this repo's hooks (tools/git-hooks). Writes repo-local config only —
# never touches the user's global config. No-op outside a git repo (e.g. a
# downloaded tarball) so install never fails. Run manually via `bun run setup:hooks`.
set -eu

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
# Warn-only: a corrupt repo config must not fail installs.
git config core.hooksPath tools/git-hooks || echo "warn: git hooks not configured — re-run your package manager’s setup:hooks script" >&2
