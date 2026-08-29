# ADR 0005: Offload Argon2 hashing to a Durable Object

Cloudflare Workers free plan limits CPU to 10 ms/request, but Argon2id requires ~700 ms with our security params. Durable Objects get 30 s CPU even on the free plan, so we offload hashing to an `AuthHasher` DO that runs a Rust/Wasm kernel compiled from `crates/argon2-do-hasher`.

**Status**: Accepted  
**Date**: 2026-06-15

## Considered options

| Option | Why rejected |
|--------|-------------|
| **`hash-wasm`** | Uses `WebAssembly.compile()`, which is explicitly forbidden in Workers. |
| **`@awasm/noble` WASM** | Same Wasm restriction. JS backend is v0.1.x, unaudited, no benefit over `@noble/hashes` for argon2. |
| **Web Crypto PBKDF2** | Fits 10 ms but lacks memory-hardness, making it weaker against GPU/ASIC attacks. |
| **External hashing service** | Adds ops/cost/network latency over a DO in the same ecosystem. |
| **Pure `@noble/hashes` in Worker directly** | ~700 ms CPU, 70x over the free plan limit. |
| **Per-user DO sharding** | *Chosen.* `idFromName(userId)` gives each user their own DO instance. Prevents one user from monopolizing a shared DO and provides natural rate limiting via serialization. Cold start cost is per-user, not global. |
| **Single shared DO (`idFromName('default')`)** | Serialized throughput of ~86 hashes/hr, acceptable for a small app but creates a global bottleneck and lets one user starve others. Replaced by per-user sharding. |

## References

The Rust/Wasm kernel in `crates/argon2-do-hasher/` was adapted from [cloudflare-auth-hasher-template](https://github.com/imjlk/cloudflare-auth-hasher-template). The template's alloc/dealloc pattern, thread-local buffer management, output/error pointer exports, string reading helpers, and validation guards were used as reference. The key difference is that the template bakes Argon2 params at compile time via `option_env!()`, while this crate accepts them as Wasm function arguments at runtime, along with salt from the JS host instead of the `getrandom` feature.

## Consequences

- The DO runs with 30 s CPU budget, so ~700 ms argon2 costs ~2% of budget.
- Cold-start on first DO invocation per user (~few hundred ms for Wasm load + compile); subsequent calls for that user are fast.
- Per-user sharding via `idFromName(userId)` isolates users and provides implicit rate limiting.
- The `cloudflare:workers` `env` import ties the hashing layer to Workers, but the rest of the auth code remains runtime-agnostic.
- Auth ops are unaware of DO sharding because `HashingStub` (in `service-bindings.ts`) carries the DO name internally. Ops provide `{name: userId}` at call sites via `HashingStub.get(name)`; the Effect service requirement routes to the correct DO stub.
- `HASHING_CONFIG` lives in `_hashing.ts` (runtime params: `m=65536, t=3, p=1, dkLen=32`). The Rust kernel accepts these at the Wasm boundary, with no compile-time params.
- `_check-rehash.ts` compares stored PHC params against `HASHING_CONFIG` and triggers a rehash on next successful login if params have strengthened.
