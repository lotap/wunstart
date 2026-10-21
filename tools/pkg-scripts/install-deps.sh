#!/bin/sh
# predev: prepare this checkout's dependencies through install-deps.
# install-deps checks freshness itself, so this runs on every `dev` start
# and repairs pulls or branch switches that changed the dependency set.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
exec sh "$DIR/run-ts.sh" "$DIR/../setup/install-deps/main.ts" --yes --quiet
