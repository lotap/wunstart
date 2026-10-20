#!/bin/sh
# Rebuild the argon2 WASM hasher. Opt-in only: the committed
# src/durable-objects/argon2-do-hasher.wasm is used by dev/build/deploy.
# Run this only after editing crates/argon2-do-hasher, then commit the result.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE="$ROOT/crates/argon2-do-hasher"
DEST="$ROOT/src/durable-objects/argon2-do-hasher.wasm"

cargo build --target wasm32-unknown-unknown --release --manifest-path "$CRATE/Cargo.toml"
cp "$CRATE/target/wasm32-unknown-unknown/release/argon2_do_hasher.wasm" "$DEST"
echo "wasm rebuilt: $DEST"
