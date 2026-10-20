#!/bin/sh
# predev: install deps with the tree's package manager.
# Skips when node_modules exists — so after branch switches or pulls that
# change deps, re-run your PM's install manually (existence is not freshness).
set -u

[ -d node_modules ] && exit 0

warn() { printf 'predev: %s\n' "$*" >&2; }

if [ -f pnpm-lock.yaml ]; then
	exec pnpm install
elif [ -f yarn.lock ]; then
	exec yarn install
elif [ -f package-lock.json ]; then
	exec npm install
elif [ -f aube-lock.yaml ]; then
	exec aube install
elif command -v bun >/dev/null 2>&1; then
	exec bun install
else
	warn 'bun not found — falling back to `npm install` (creates package-lock.json; re-run setup to switch back)'
	exec npm install
fi
