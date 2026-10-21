#!/bin/sh
# db: run drizzle-kit with the worktree env overlay.
# Usage: sh tools/pkg-scripts/drizzle-kit.sh <drizzle-kit args...>
# Design: file values win over exported environment (same contract as
# branch-env's own children and the dev server). --override lets files beat
# exported vars; with it the LAST file wins, so .env.local stays second.
set -u

exec dotenv -e .env.development -e .env.local --override -- drizzle-kit "$@"
