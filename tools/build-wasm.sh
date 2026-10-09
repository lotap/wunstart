#!/bin/sh
# Build the argon2 WASM hasher, sharing work across git worktrees.
#
# Two mechanisms (both live next to the worktrees, outside any worktree):
# - $PARENT/.shared-cargo-target: shared CARGO_TARGET_DIR, so dependency
#   crates are compiled once instead of once per worktree.
# - $PARENT/.shared-wasm-cache: finished .wasm files keyed by content hash
#   of the Rust sources + toolchain, so a new worktree with unchanged
#   sources just copies the file without invoking cargo at all.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"
CRATE="$ROOT/crates/argon2-do-hasher"
DEST="$ROOT/src/durable-objects/argon2-do-hasher.wasm"
SHARED_TARGET="$PARENT/.shared-cargo-target"
CACHE_DIR="$PARENT/.shared-wasm-cache"

HASH="$( (cat "$CRATE/Cargo.toml" "$CRATE/Cargo.lock"; cat "$CRATE"/src/*.rs; rustc -V) | shasum -a 256 | cut -d' ' -f1)"
CACHED="$CACHE_DIR/argon2-do-hasher-$HASH.wasm"

if [ -f "$CACHED" ]; then
	cp "$CACHED" "$DEST"
	echo "wasm cache hit ($HASH): copied to $DEST"
	exit 0
fi

CARGO_TARGET_DIR="$SHARED_TARGET" cargo build --target wasm32-unknown-unknown --release --manifest-path "$CRATE/Cargo.toml"
mkdir -p "$CACHE_DIR"
cp "$SHARED_TARGET/wasm32-unknown-unknown/release/argon2_do_hasher.wasm" "$DEST"
cp "$SHARED_TARGET/wasm32-unknown-unknown/release/argon2_do_hasher.wasm" "$CACHED"
echo "wasm built + cached ($HASH)"
