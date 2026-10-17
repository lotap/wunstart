# App: routes, frontend, runtime

## Routes (TanStack file-based)

- `_`-prefixed dirs = pathless layouts; `-components/` = route-private, not routed. Never edit `routeTree.gen.ts` (regenerate via `generate-routes` or dev restart).
- `_auth-*` placement IS the guard — moves across folders are security-relevant in review: `_auth-protected` (requires sign-in, redirect `/sign-in?redirect=`, wraps `HasSudoProvider`), `_auth-gateway` (auth-flow only, sign-in/up, authed bounce `/`), `_auth-dynamic` (no redirect, adapts; marketing that changes its call by auth — e.g. pricing with manage-vs-buy CTA; `HasSudoProvider key={auth ? 'user' : 'anon'}` resets stale sudo), `_auth-anon` (no guard/provider — public pages where auth state is irrelevant, e.g. static pricing). Layout `route.tsx` often comment-only docs of the implied protection.
- Chrome: `Header`/`Footer` mount in the `__root` shell (`components/header.tsx`, `components/footer.tsx`); the header branches on `context.auth`. Chrome edits render on every route — verify across layouts and both identity modes.
- Auth verified exactly once in `__root.tsx` `beforeLoad` → `handleVerifyAuth()` (returns only `{sudoExpiresAt?}`, no db ids to client). Layouts read `context.auth`; never re-call in children. Data via `useQuery` + `useServerFn`; loaders allowed where SSR/first-paint/SEO wins (public content), keeping auth verify in `beforeLoad` only. `validateSearch` also via `Schema.toStandardSchemaV1`. Db ids never travel client→server (path, search, or fn input) — identity unwraps from cookies; non-id params (slugs) allowed via validated search/path.
- Settings nav: register in `routes/_auth-protected/settings/categories.ts` (`CATEGORIES`, section-component-free); components attach in `-components/page.tsx`.
- Drawers: self-contained components with trigger props (`PasswordChangeDrawer triggerClassName/triggerVariant`, composed in `access-and-security.tsx`); lazy-load when heavy (`dashboard.tsx` → `welcome-drawer.tsx`). One-shot post-action UX via a `useLocation().state` flag cleared with `navigate({to, state})` on dismiss.

## Adding a page

Pick `_auth-*` placement → `handle-*.ts` (shape: see `references/middleware.md`) → `queryOptions` beside the feature (shared ones in `components/<domain>/_utils.ts`; keys `['<thing>', ...params]`, e.g. `['passcodeRequest', email, intent]`) → reads via `useQuery` + inline pending/error inside `ErrorBoundary` (search via `Route.useSearch`) → navigate via `router.navigate({to, state})`; button-styled links via `RouterButton`, text links via `Link`; never `<a href>` for internal routes or `Button`+onClick nav → `generate-routes` → verify (lint + tsgo). Auth changes end with `router.invalidate()`. Exemplars: list query `settings/-components/sessions.tsx`, page with search `settings/`, sudo-gated mutation `components/auth/remove-account.tsx`, email flow `components/auth/email-change.tsx`.

## Frontend

- React Compiler ON (babel preset in `vite.config.ts`): zero `useMemo` / `useCallback` / `React.memo` in hand code. Don't hand-memoize.
- New files use named exports; default only where an external consumer requires it (e.g. email templates for email dev, `server.ts`, `theme-toggle.tsx`, `root-provider.tsx`, `integrations/tanstack-query/devtools.tsx`, `form-fields/password-strength-meter.tsx`).
- Zero `React.FC` — prefer inline `props: {...}` object types over `interface` (pre-existing infra `interface`s are grandfathered). `React.ReactNode` via global namespace, no React import. No `"use client"` in hand code.
- Optimistic updates encouraged for reversible product mutations (rollback on error, reconcile with server value); auth/security/ban paths stay invalidate-then-refetch — never guess server-computed values (one exception `setQueryData` with server-computed value on mutation success).
- Feedback: forms → `OnSubmitErrors`; non-form mutations → `toast` (`components/ui/toast.tsx`); reads → inline pending/error inside `ErrorBoundary` (route-level `errorComponent: RouteError` + `notFoundComponent` live in `__root`). `AsyncBoundary` wraps a lazy/async subtree in both so a failed query or chunk load degrades locally instead of unmounting the page. Unknown data on first load → inline `Skeleton` sized to the expected content so layout never shifts (match w/h to the value, comment the match); sections/forms mirror shape with stacked `Skeleton`s in place; never blank, spinner-only, or guessed values.
- Contexts recipe: `createContext<T | null>(null)` + throwing `use*` hook + `PropsWithChildren` provider. Theme tri-state (`null` = not hydrated; consumers must handle). Query client via `integrations/tanstack-query/root-provider: getContext() → {queryClient}`.
- shadcn on Base UI (`@base-ui/react`), cssVariables. Current install choices — `base-nova` flavor, neutral base, lucide icons — are swappable identity, not constraints; change freely for your own look. `src/components/ui/**` generated — don't edit; override from caller via `cn()`; patch only for new export/variant/behavior, minimal. Caller pattern `render={<X />}` never `asChild`; `render={<Link to=… />}` works. Icons via `lucide-react` today (`data-icon` pattern per shadcn skill). Three-way split: behavior modes get explicit components (never boolean mode props); style variants get CVA props; booleans carry data/state only (`isPinned`, `isCurrent`).
- Forms (`hooks/use-app-form.ts`, TanStack Form alpha): `createFormHook({fieldComponents: CheckboxField/EmailField/PasscodeField/PasswordField, formComponents: SubmitButton/OnSubmitErrors})`; `useConfiguredAppForm({defaultValues, onSubmitTry, onSubmitSchema: ConstraintCodec})`, `validateAfterFirstSubmit` (silent until attempts > 0, then change + blur). Fields take `{field: FieldWithValue<string>}`, `isTouched && !isValid`, `ui/field` + `input`/`input-group`, sr-only labels, `aria-invalid`/`describedby`, min/maxLength mirrors schema. `components/auth/_*` private by `_` prefix. Shared `passcodeRequestQueryOptions` / `userProfileQueryOptions`; localStorage email/step with `DateTime` + 24h.
- `useLocalStorageQuery({key, schema})`: Query over localStorage (`[localStorage, key]`, Infinity stale), schema-validated, `Expiry.expiresAt` eviction, merge-mutate + cross-tab invalidate.
- Styling: Tailwind v4 CSS-first (`styles.css`): oklch vars `:root` / `.dark`, `@theme inline`, `@custom-variant dark`, Inter Variable, view-transition on main + reduced-motion guard. `cn()` from `'cn'` (`#/lib/utils.ts` is only a re-export shim); oxfmt sorts Tailwind (stylesheet `styles.css`, functions `[clsx, cn]`). Stock shadcn token names only.
- `src/isomorphic/` stays pure es2022 (no node/browser): Email (trim + lower + 254 + regex) / Password (8char + NFKC + 72B) / Passcode (`/^\d{6}$/`), one export per shape in `validations/auth.ts`, `mask-email` (`j***@domain`), zxcvbn lazy dicts `MIN_SCORE = 3` + `[<your product name per CONTEXT.md>, ...userInputs]`. Shared client + server via `toStandardSchemaV1`.

### Custom hooks

Shared primitives live in `hooks/`; feature composition in `components/<domain>/_hooks.ts` (see `auth/_hooks.ts`).

- Shared client state (e.g. a checkout cart visible on every page): `useLocalStorageQuery({key, schema})` → `{query, mutation, remove}`. Key `['localStorage', key]`, `staleTime: Infinity`, schema-validated reads (malformed/expired → null + evicted), merge-`mutate`, cross-tab invalidation via `storage` events. Same key on any page reads the same state; `mutation.mutate(partial)` from any page updates all mounted readers. Wrap per concern (`useLocalStorageEmail`-style) and stamp `expiresAt` on writes (24h in auth). Shape, following `useLocalStorageAuthFormState`:
  ```ts
  export function useCart() {
  	const {query, mutation, remove} = useLocalStorageQuery({key: 'cart', schema: CartSchema})
  	return {
  		items: query.data?.items ?? [],
  		isPending: query.isPending,
  		upsertItem: (item: CartItem) => mutation.mutate({items: mergeInto(query.data?.items, item)}),
  		clear: remove,
  	}
  }
  ```
- Action hooks follow `use-sign-out`: `useServerFn(fn)` → try → `router.invalidate()` → catch → `toast.add({type: 'error', …})`.
- Context consumers: `useTheme()` gives `theme` (setting, incl. `system`) vs `resolved` (effective light/dark); `null` pre-hydration → render Skeleton; toggle cycles system→flip (see `theme-toggle.tsx`, `contexts/theme.tsx`).

### Form interactions

- `useConfiguredAppForm({defaultValues, onSubmitTry, onSubmitSchema})` with field components (`CheckboxField`/`EmailField`/`PasscodeField`/`PasswordField`). To add a field type, three steps (see `form-fields/email.tsx`): `({field}: {field: FieldWithValue<string>})` component built from `ui/field` + `input` (sr-only label, `isTouched && !isValid`, `aria-invalid`/`describedby`, `FieldError`); register via `fieldComponent.strict(Comp, 'field')` in `hooks/use-app-form.ts`; consume as `<field.XField />` render prop.
- Validation splits two ways: `onSubmitSchema` (isomorphic `ConstraintCodec`, silent until first submit via `validateAfterFirstSubmit`) checks shape client-side; external checks (e.g. address/zip validation against an API) run server-side inside `onSubmitTry` — throw on failure. Server errors are form-level only (`fields: {}` in `use-app-form.ts`); there is no field-targeted server error path, so design external checks as pass/fail for the whole submission.
- Drafts: prefill `defaultValues` from the localStorage query, persist via its mutation (see sign-up email); multi-step flows keep `step`/`setStep` in localStorage state (`useLocalStorageAuthFormState`).
- Submit through a server fn (`useServerFn`) directly, or a feature mutation (`usePasscodeRequestMutation`-style, `setQueryData` on success).

## Runtime

- `src/server.ts`: Workers entry (`wrangler.jsonc` main) — re-exports `AuthHasher` DO + Start fetch handler + `scheduled` cron (archives old records). Bindings HYPERDRIVE, `send_email: EMAIL`, `AUTH_HASHER` DO + migrations; `env.development.secrets.required` = `*_SECRETS` (`id:secret` pairs); provision the same secrets in prod (`wrangler secret put`) alongside the email config. `src/start.ts`: `createStart` factory (request + function middleware). `src/router.tsx`: router + Query wiring. `cf-typegen` after `wrangler.jsonc` binding change.
- Wasm: `assetsInclude **/*.wasm`, watch ignores `.tmp`.
- Effect services: `Context.Service` + `Layer.effect`, return `Service.of({...})`, `Effect.fn('Service.method')` for tracing, `Schema.TaggedErrorClass` errors, `Config.schema(Schema.Literals([...]), 'ENV')` plural-array + typed `withDefault` / `option` / `redacted`. No keyof casts, no string fail. Lazy `cloudflare:workers` via `Effect.tryPromise(import())`.
- TS v6 tsgo: strict + `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride/Returns`, `verbatimModuleSyntax` (`import type` for types), `allowImportingTsExtensions`. `@effect/language-service` downgrades 22 diagnostics to warnings scoped to `src/db/**`. No typecheck script → `bunx tsgo --noEmit`.
