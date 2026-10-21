#!/bin/sh
# Runtime dispatcher for the setup phase scripts: prefers bun, then nub
# (both run .ts natively), then node 22.18+ (type stripping). The phase
# programs are dependency-free, so this works in a fresh checkout before
# `install-deps` has run.
set -eu
if [ "$#" -lt 1 ]; then
	echo "usage: run-ts.sh <entry.ts> [args...]" >&2
	exit 2
fi
ENTRY="$1"
shift
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
LIB_DIR="$(cd "$DIR/../helpers" && pwd)"
case "$ENTRY" in
	/*) ;;
	*) ENTRY="$ROOT/$ENTRY" ;;
esac
# Single source for the floor: MINIMUM_NODE_VERSION in process.ts greps
# cleanly (keep that line's `NAME = 'x.y'` shape); the shell cannot import
# TS. Fail closed on an unparsable line — a silent fallback could disagree
# with the TS gate.
FLOOR="$(grep -o "MINIMUM_NODE_VERSION = '[0-9.]*'" "$LIB_DIR/process.ts" 2>/dev/null | head -1 | grep -o '[0-9.]*' || true)"
case "$FLOOR" in
	[0-9]*.[0-9]*) ;;
	*)
		echo "FAIL unreadable node floor (missing MINIMUM_NODE_VERSION in $LIB_DIR/process.ts)" >&2
		exit 1
		;;
esac
if command -v bun >/dev/null 2>&1; then
	exec bun "$ENTRY" "$@"
elif command -v nub >/dev/null 2>&1; then
	exec nub "$ENTRY" "$@"
elif command -v node >/dev/null 2>&1; then
	if ! node -e 'const f = process.argv[1].split(".").map(Number); const v = process.versions.node.split(".").map(Number); process.exit(v[0] > f[0] || (v[0] === f[0] && v[1] >= f[1]) ? 0 : 1)' "$FLOOR" 2>/dev/null; then
		echo "FAIL node $(node --version 2>/dev/null || echo unknown) cannot run this phase (needs $FLOOR+ for type stripping)" >&2
		echo "hint: install bun (https://bun.sh) or node $FLOOR+ — then re-run this script" >&2
		exit 1
	fi
	exec node "$ENTRY" "$@"
else
	echo "FAIL no JS runtime found (need bun, nub, or node $FLOOR+)" >&2
	echo "hint: install bun: https://bun.sh — then re-run this script" >&2
	exit 1
fi
