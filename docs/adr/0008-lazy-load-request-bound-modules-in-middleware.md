# ADR 0008: Lazy-load `cloudflare:workers`-dependent modules in middleware

**Status**: Accepted  
**Date**: 2026-06-29

## Context

The dev server threw `TypeError: Cannot read properties of undefined (reading 'options')` inside TanStack's `flattenMiddlewares` whenever a server function was called. The error occurred on any route whose `beforeLoad` invoked a server function, including `/sign-up`, `/`, `/settings`.

The crash was caused by the `verifyAuth` middleware being `undefined` at the time the middleware chain was built. The build chain was:

```
start.ts → functionMiddleware: [createRateLimit(100), verifyAnon]
  → verifyAnon.middleware([verifyAuth])
    → verifyAuth.middleware([getForwardedIp])
```

Anon token issuing (previously described as a separate `issueAnon` middleware) is inline inside `verifyAnon`'s `.server()` handler. When no existing anon cookie is found, `signAnon` is called directly and the cookie is set.

`verify-auth.ts` statically imported `refresh` and `verifyAccess`, ops that transitively import `db/index.ts` and `service-bindings.ts`. These modules themselves load fine (Cloudflare docs confirm top-level `import {env}` works for binding properties), but TanStack Start's module graph resolver treated the import chain differently when the imports lived in a middleware file versus a handler file. The result was that the `verifyAuth` middleware was `undefined` at the time the middleware chain was built. When `flattenMiddlewares` recursed into `verifyAnon.options.middleware`, it encountered `undefined` and crashed reading `.options`.

Modules that don't depend on `cloudflare:workers` (e.g., anon-token ops `signAnon`/`verifyAnonOp`, which use only `jose` and Effect Config) loaded without issue.

## Considered options

| Option | Why rejected |
|--------|-------------|
| **Decouple `verifyAnon` from `verifyAuth`** | Preserved the auth-context shape but changed the global context interface (`auth` no longer provided globally) and duplicated auth-cookie checks across two middleware files. |
| **Defer `env.HYPERDRIVE.connectionString` access in `db/index.ts` via `Layer.unwrap`** | Unnecessary. Cloudflare docs confirm `import {env} from 'cloudflare:workers'` is safe at top-level for env vars/secrets and binding properties like `connectionString`. Reading the string at eval time works in both dev and prod. |
| **Make `service-bindings.ts`/`db/index.ts` lazily import `cloudflare:workers`** | Most systemic, but `HashingStub.get` is synchronous; making it async would ripple across every call site. Also, these modules are only loaded early because the middleware imports them, so fixing the middleware boundary is more direct. |
| **Dynamic `import()` inside `verifyAuth`'s `.server()` handler** | Breaks the static-import chain at the middleware boundary. Middleware objects must be defined at module load (early); handlers run at request time (late). Ops are only needed inside the handler. This localizes the fix. |

## Decision

Import `refresh` and `verifyAccess` via dynamic `import()` inside the `.server()` handler of `verifyAuth`, rather than statically at the top of the file.

- The middleware object is now always defined, so `flattenMiddlewares` never sees `undefined`.
- The `cloudflare:workers`-dependent modules load lazily on the first request that has auth cookies, by which time the binding is available.
- Anon-token middleware (`verifyAnon`) continues to work because `verifyAuth` is no longer undefined. Anon token issuing is inline in `verifyAnon`'s handler, not a separate middleware.

### Caveat on caching

ESM natively caches modules. Repeated `import()` calls return the same module namespace after the first load. No manual memoization is needed, and in dev it avoids holding stale references across HMR invalidations.

### Why this is the right boundary

Middleware modules are evaluated early (during SSR module graph setup). Server-fn handler modules and their dependencies are loaded lazily on invocation. The fix respects this boundary. Middleware shapes are constructed eagerly, and request-bound dependencies are deferred until request time.

## Consequences

- `verifyAuth`'s `.server()` handler now uses `await import(...)`, a minor async overhead per request that has auth tokens. Native cache means no re-evaluation.
- Deferring `env.HYPERDRIVE.connectionString` access via `Layer.unwrap` was tried and reverted. Per Cloudflare docs, top-level `import {env}` works for binding properties like `connectionString`, so the indirection adds complexity without benefit. Included here as a dead end to avoid accidental re-implementation.
- Other middlewares or server functions that statically import `cloudflare:workers`-dependent modules *and* are loaded in the early SSR graph would face the same problem. Future middleware authors should prefer dynamic imports for request-bound dependencies.
- The `start-types.ts` `AuthContext` import remains a type-only import (erased at runtime), so it does not reintroduce the problem.

## References

- ADR 0005: offload hashing to Durable Object (source of `cloudflare:workers` dependency in auth ops)
