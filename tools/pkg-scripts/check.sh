#!/bin/sh
# Full compliance gate, manager-neutral: the same fail-fast sequence as the
# individual package scripts, run from local binaries without invoking a
# package manager. Works from `npm run check`, `pnpm run check`, or any other
# manager because every dependency is resolved through node_modules/.bin.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd -P)"
cd "$ROOT"
PATH="$ROOT/node_modules/.bin:$PATH"
export PATH

missing() {
	echo "FAIL $1 not found in node_modules/.bin" >&2
	echo "hint: run this checkout’s install-deps script with the package manager you use, then re-run check" >&2
	exit 1
}

for tool in oxfmt oxlint tsc dotenv drizzle-kit; do
	command -v "$tool" >/dev/null 2>&1 || missing "$tool"
done

oxfmt --check src/ tools/
oxlint --deny-warnings src/ tools/
sh tools/pkg-scripts/run-ts.sh tools/linters/tailwind/main.ts
tsc --noEmit
sh tools/pkg-scripts/drizzle-kit.sh check
