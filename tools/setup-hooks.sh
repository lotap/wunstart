#!/bin/sh
# Point git at this repo's hooks (tools/hooks). Writes repo-local config only —
# never touches the user's global config. No-op outside a git repo (e.g. a
# downloaded tarball) so install never fails. Run manually via `bun run setup:hooks`.
set -eu

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git config core.hooksPath tools/hooks
