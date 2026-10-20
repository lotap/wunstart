#!/bin/sh
# db: run drizzle-kit with the worktree env overlay.
# Usage: sh tools/helpers/drizzle-kit.sh <drizzle-kit args...>
# (.env.local overrides .env.development — order matters.)
set -u

exec dotenv -e .env.local -e .env.development -- drizzle-kit "$@"
