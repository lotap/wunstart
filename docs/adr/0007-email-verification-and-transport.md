# ADR 0007: Email verification and transport

**Status**: Accepted
**Date**: 2026-06-23
**Amended**: 2026-08-21. Transport descriptions updated to match the shipped implementation (config-driven transport selection, real Brevo transport, failure-kind classification; the Mailpit console fallback was never implemented)

Signup requires proof that the person controls the email address before a `users` row is created. A 6-digit code is emailed to the address; the user enters it to authorize account creation. Email sending is abstracted behind an `EmailService` Effect service with three transports selected by configuration: Mailpit (development), a Cloudflare Workers `send_email` binding, and Brevo (production), with a configurable production fallback chain. Email-sending capability flows through server functions that explicitly pass the `emailLayer`.

## Context

ADR 0001 deferred the "forgot password" flow, noting it requires email infrastructure. Signup today creates a `users` row (with PII: email + password hash) the moment credentials are submitted, with no proof of email ownership. This enables squatting (a bad actor registers someone else's email) and leaves unverified PII in the database indefinitely.

Requirements:
- A user row exists only after the email is verified.
- The dev server sends real emails without depending on any external SaaS.
- The production transport is selected by configuration and swappable without touching ops.
- Email-sending capability is constrained to one code path (abuse surface minimization).
- No email enumeration: an attacker cannot learn which addresses are registered.

## Decision

**Verify before create.** An `email_verifications` table (active+archive pair per ADR 0006) holds the email, a hashed 6-digit code, attempt count, and expiry. The same table serves multiple flows (sign-up verification, sign-in notifications, password-change confirmations). Each row is keyed by email + entityId (anonId or userId). The `users` row is created only after the code is verified. The 6-digit code is hashed with argon2id via the `AuthHasher` Durable Object (ADR 0005) before storage, consistent with the codebase's hash-secrets philosophy, even though a 6-digit keyspace is small. The `users` table has no `emailVerifiedAt` column; every user that exists is verified by construction.

Form state (email, step position) persists across page reloads via `localStorage` with a 7.5-minute TTL. The client passes both email and passcode in the sign-up body; the server validates the passcode against the DB verification row keyed by that email + the caller's entityId.

A single Effect service, `EmailService`, abstracts the transport. Transports are selected by configuration: development defaults to Mailpit's HTTP API (`EMAIL_TRANSPORT` may also select the Workers binding or Brevo); production defaults to the Workers `send_email` binding with Brevo behind a configurable fallback chain (`EMAIL_FALLBACK`). Send failures carry a kind: `config`, `transient`, `rejected`, or `ambiguous` (acceptance unknown). The chain reacts to the kind: a permanent refusal stops immediately, other kinds fall through to the next transport, and one whole-chain retry runs only when every hop provably refused before acceptance; an ambiguous outcome is never re-sent. There is no console fallback. A failed Mailpit send surfaces as an error so a developer notices when Mailpit is unreachable. The `emailLayer` is only provided where email is actually sent: the verification/sign-in/password server functions (`handleEmailRequestVerification`, `handleEmailSignIn`, `handlePasswordSignIn`, `handlePasswordChange`) and the auth middleware's refresh path (session-revoked notification).

## Considered options

| Option | Why rejected |
|--------|-------------|
| **Create user first, verify later** | Leaves unverified PII (email + password hash) in `users` indefinitely. Unique-email index lets a bad actor squat someone else's email before they sign up. Requires a "claim unverified user" reconciliation flow. |
| **Plaintext code in DB** | A DB-read attacker sees the code directly. Hashing via the DO adds one call per verify (negligible, since verifies are rare) and matches the codebase's hash-secrets convention. |
| **Server-persisted verification state via cookie** | A httpOnly cookie carrying the verification row uuid would identify which row to read at verification time. Adds cookie plumbing for no real UX gain. localStorage already persists the email + step state client-side, and the DB is the authoritative store for the passcode verification. The server identifies the verification row by email + entityId (anonId or userId) in the query parameters. |
| **Per-email send cooldown** | Any per-email cap is abusable: an attacker can block a legitimate user from signing up by exhausting the quota. Per-IP rate limit + failure-weight bans are the ceiling. |
| **Email enumeration on duplicate** | Returning "account already exists" lets an attacker probe which addresses are registered. `handleEmailRequestVerification` always returns `{expiresAt}` for syntactically valid email. |
| **Separate resend op + `resendCount` cap** | Extra op and server fn for no benefit. Re-calling `handleEmailRequestVerification` archives the old intent and creates a fresh one, which is simpler with the same UX. |
| **`/check-email` route for reload resume** | A `beforeLoad` + GET status server fn restores step in-place. No extra route or redirect logic needed. |
| **`unique(codeHash)` index** | The DO salts each hash randomly (16-byte salt), so identical codes produce different hashes. The constraint never fires and lookup is by email, not hash. Dead index. |
| **`EmailService` importable from anywhere** | Email sending is an abuse surface. The `emailLayer` is only provided where email is actually sent (`handleEmailRequestVerification`, `handleEmailSignIn`, `handlePasswordSignIn`, `handlePasswordChange`, and the auth middleware's refresh path). New email-sending code must add an explicit layer pass, making it visible in review. |
| **Workerd-native `send_email` binding for dev** | Requires SPF/DKIM setup before any local dev works. Mailpit is zero-config. |

## Consequences

- **`email_verifications` table** is the new domain table. It serves sign-up verification, sign-in notifications, and password-change confirmations. Each row is keyed by email + entityId (anonId for unauthenticated callers, userId for authenticated ones).
- **No `emailVerifiedAt` column** on `users`. Every user that exists is verified by construction. Sign-in never needs an "unverified" branch.
- **`Password` validator extracted** from `AuthCredentials` into `#/isomorphic/validators.ts` so it can be reused across multiple form components and validation schemas independently of the `AuthCredentials` type.
- **`createUser` helper extracted** from `sign-up.ts` into `_create-user.ts` so `emailSignUp` reuses the user + session + access-token + retireAnon transaction without duplication.
- **`successWeight` on `createOpsFn` is deferred.** Successful intent requests log weight 1 (default); the per-IP 5/min rate limit is the sole ceiling on send volume. A follow-up can add a `successWeight` option so 6 sends/10min trips the ban pipeline.
- **Transport failures are classified, not retried blindly**. Brevo maps 401/403 to `config`, 429 to `transient`, other 4xx to `rejected`, and anything else to `ambiguous`; the fallback chain and the single whole-chain retry key off that kind (per the post-commit side-effect policy in ADR 0009). Mailpit is development-only and its failures are deliberately visible rather than papered over with a console print.
- **Form state is localStorage-based**. Email and step position are persisted in `localStorage` with a 7.5-minute TTL (matching the passcode expiry). No `verification` cookie. The server identifies the verification row by email + entityId (anonId or userId) in the query parameters; the DB is the authoritative store for passcode verification.

## References

- ADR 0001: auth strategy (deferred email infrastructure)
- ADR 0003: credential/ban weight routing
- ADR 0005: offload hashing to Durable Object
- ADR 0006: active/archive table pairs
