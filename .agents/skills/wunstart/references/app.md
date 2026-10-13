# App: routes, frontend, runtime

## Routes (TanStack file-based)

- `_`-prefixed dirs = pathless layouts; `-components/` = route-private, not routed. Never edit `routeTree.gen.ts` (regenerate via `generate-routes` or dev restart).
- `_auth-*` placement IS the guard — moves across folders are security-relevant in review: `_auth-protected` (requires sign-in, redirect `/sign-in?redirect=`, wraps `HasSudoProvider`), `_auth-gateway` (sign-in/up only, authed bounce `/`), `_auth-dynamic` (no redirect, adapts; `HasSudoProvider key={auth ? 'user' : 'anon'}` resets stale sudo), `_auth-anon` (no guard/provider). Layout `route.tsx` often comment-only docs of the implied protection.
- Auth verified exactly once in `__root.tsx` `beforeLoad` → `handleVerifyAuth()` (returns only `{sudoExpiresAt?}`, no db ids to client). Layouts read `context.auth`; never re-call in children. Zero loaders in codebase — data is `useQuery` + `useServerFn`. `validateSearch` also via `Schema.toStandardSchemaV1`.

## Frontend

- React Compiler ON (babel preset in `vite.config.ts`): zero `useMemo` / `useCallback` / `React.memo` in hand code. Don't hand-memoize.
- Named exports everywhere except email templates (default required by email dev), `theme-toggle.tsx`, `root-provider.tsx`, `server.ts`. Zero `React.FC` — prefer inline `props: {...}` object types over `interface` (a few infra `interface`s in `start-types.ts` / `auth-hasher.ts` predate this). `React.ReactNode` via global namespace, no React import. No `"use client"` in hand code.
- No optimistic updates. Invalidate-then-refetch; one exception `setQueryData` with server-computed value on mutation success.
- Contexts recipe: `createContext<T | null>(null)` + throwing `use*` hook + `PropsWithChildren` provider. Theme tri-state (`null` = not hydrated; consumers must handle). Query client via `integrations/tanstack-query/root-provider: getContext() → {queryClient}`.
- shadcn `base-nova` flavor, Base UI (`@base-ui/react`), neutral, cssVariables, lucide. `src/components/ui/**` generated — don't edit; override from caller via `cn()`; patch only for new export/variant/behavior, minimal. Caller pattern `render={<X />}` never `asChild`; `render={<Link to=… />}` works. Icons `lucide-react`, `data-icon` pattern per shadcn skill.
- Forms (`hooks/use-app-form.ts`, TanStack Form alpha): `createFormHook({fieldComponents: Checkbox/Email/Passcode/Password, formComponents: SubmitButton/OnSubmitErrors})`; `useConfiguredAppForm({defaultValues, onSubmitTry, onSubmitSchema: ConstraintCodec})`, `validateAfterFirstSubmit` (silent until attempts > 0, then change + blur). Fields take `{field: FieldWithValue<string>}`, `isTouched && !isValid`, `ui/field` + `input`/`input-group`, sr-only labels, `aria-invalid`/`describedby`, min/maxLength mirrors schema. `components/auth/_*` private by `_` prefix. Shared `passcodeRequestQueryOptions` / `userProfileQueryOptions`; localStorage email/step with `DateTime` + 24h.
- `useLocalStorageQuery({key, schema})`: Query over localStorage (`[localStorage, key]`, Infinity stale), schema-validated, `Expiry.expiresAt` eviction, merge-mutate + cross-tab invalidate.
- Styling: Tailwind v4 CSS-first (`styles.css`): oklch vars `:root` / `.dark`, `@theme inline`, `@custom-variant dark`, Inter Variable, view-transition on main + reduced-motion guard. `cn()` from `#/lib/utils.ts`; oxfmt sorts Tailwind (stylesheet `styles.css`, functions `[clsx, cn]`). Stock shadcn token names only.
- `src/isomorphic/` stays pure es2022 (no node/browser): Email (trim + lower + 254 + regex) / Password (8char + NFKC + 72B) / Passcode (`/^\d{6}$/`), one export per shape in `validations/auth.ts`, `mask-email` (`j***@domain`), zxcvbn lazy dicts `MIN_SCORE = 3` + `['wunstart', ...userInputs]`. Shared client + server via `toStandardSchemaV1`.

## Runtime

- `src/server.ts`: Workers entry (`wrangler.jsonc` main) — re-exports `AuthHasher` DO + Start fetch handler + `scheduled` cron (`30 6 * * *`, archives > 30d). Bindings HYPERDRIVE, `send_email: EMAIL`, `AUTH_HASHER` DO + migrations v1; `env.development.secrets.required` = 4× `*_SECRETS` (`id:secret` pairs). `src/start.ts`: `createStart` factory (request + function middleware). `src/router.tsx`: router + Query wiring. `cf-typegen` after `wrangler.jsonc` binding change.
- Wasm: `assetsInclude **/*.wasm`, watch ignores `.tmp`.
- Effect services: `Context.Service` + `Layer.effect`, return `Service.of({...})`, `Effect.fn('Service.method')` for tracing, `Schema.TaggedErrorClass` errors, `Config.schema(Schema.Literals([...]), 'ENV')` plural-array + typed `withDefault` / `option` / `redacted`. No keyof casts, no string fail. Lazy `cloudflare:workers` via `Effect.tryPromise(import())`.
- TS v6 tsgo: strict + `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride/Returns`, `verbatimModuleSyntax` (`import type` for types), `allowImportingTsExtensions`. `@effect/language-service` downgrades 22 diagnostics to warnings scoped to `src/db/**`. No typecheck script → `bunx tsgo --noEmit`.
