# ADR 0009: Email delivery is a best-effort post-commit side effect

**Status**: Accepted
**Date**: 2026-08-13

Email delivery is an unimportant side effect. A notification failure after its database mutation has committed must never make that mutation appear to fail. Emails are rendered before the authoritative mutation, sent best-effort after commit, and delivery failures are logged, never retried durably, never persisted.

## Context

Before this ADR, ops rendered and sent notification emails after their database work had already committed (`password-sign-in`, `password-change`, `email/sign-in`, `email/request-passcode`). If the render or provider send failed, the op returned an error even though the session, password, or verification row had committed. The client would retry, producing duplicate sessions or verification codes.

Two failures had to be distinguished:

- **Pre-commit failures** (validation, hashing, rendering) may fail the operation, as nothing is committed yet.
- **Post-commit failures** (provider outage, transient send error) must never misreport an already-committed mutation.

A transactional outbox table was prototyped to make delivery durable, then rejected (see below).

## Decision

**The verification email is the deliverable and must not silently fail.** `email/request-passcode` renders before the row upsert (a render failure fails the op while nothing is committed) and a provider send failure fails the op with an `EMAIL_SEND` activity, so the user is told the code never went out instead of waiting for one that will never arrive. On send failure the op retires the just-minted verification intent (guarded by its passcode hash, so a concurrent reset is left alone), letting an immediate retry mint a fresh code instead of hitting the `TOO_SOON_SINCE_LAST_RESET` window.

**Notification emails are nice-to-have post-commit side effects.** For `email/sign-in`, `password-sign-in`, and `password-change`, the notification and its render run entirely after the commit, wrapped in `Effect.ignore({log: true, message})`. Neither a render failure nor a provider/database/defect failure can fail the op or misreport the committed mutation. The refresh-reuse notification (`refresh.ts`) follows the same pattern. The `ignore` log message is the observable failure policy: each send site names the notification it failed to dispatch.

**No retry, no persistence.** A failed send is not retried and the email is never stored. Consequences per flow:

- **Verification code emails**: a send failure surfaces to the user, who re-requests one. The new request archives the retired intent and mints a fresh code (`resetFromExpiringByEmail`). The flow self-heals.
- **Sign-in, password-change, and session-reuse notifications**: informational. Losing one in a provider outage is acceptable.

## Considered options

| Option | Why rejected |
|--------|-------------|
| **Keep sending after commit, fail the op on send error** | Misreports committed state; client retries create duplicate sessions or codes. This is the bug being fixed. |
| **Transactional outbox table** | The rendered email (including the plaintext verification passcode) would sit in the database, violating the hash-secrets invariant of ADR 0007, where passcodes exist in the DB only as Argon2 hashes. The archive table would retain the code indefinitely. Encrypting the payload would restore confidentiality but adds key management to Workers for a self-inflicted problem, and the archive still grows unbounded with PII-bearing email content. |
| **Cloudflare Queue** | Same payload-at-rest problem (the rendered email must live somewhere until a consumer picks it up), plus queue/consumer deployment configuration. |
| **Store template + params instead of rendered email** | Still persists PII (recipient, IP address, code) at rest, and couples delivery to the template code that existed at commit time. |
| **Retry on failure** | Retrying an ambiguous send (provider may have accepted the message) duplicates delivery without improving the flows, which self-heal or are informational. |

## Consequences

- **Ops still call `EmailService.send` directly.** `email/request-passcode` treats send failures as typed `EMAIL_SEND` operation failures with a best-effort compensating archive; every other send site runs post-commit through `Effect.ignore` so delivery can never fail the op. The `emailLayer` remains provided only to ops that send email (abuse-surface minimization per ADR 0007).
- **Verification-code renders moved pre-commit** in `email/request-passcode`. Its render failure path changed from a misreported committed mutation to a safe pre-mutation failure.
- **Notification renders moved post-commit** in `email/sign-in`, `password-sign-in`, and `password-change`; render failures became logged-and-swallowed instead of failing the op. The password-change confirmation uses the database `updatedAt` from the committed update.
- **Email content never persists**. No table, migration, cron, or sweep infrastructure. Activity metadata for `EMAIL_SEND` failures stores only the transport name and provider error code, never message bodies or email content, consistent with the activity-redaction policy that forbids persisting email bodies, tokens, and raw provider responses. The `Effect.ignore({log: true})` calls are the only record of notification delivery failures.
- **Email retryability classification shrinks in scope**: since nothing is retried at the application layer, classifying a provider failure as permanent, transient, or ambiguous only matters for the transport-layer fallback chain (`EMAIL_FALLBACK`). Transports tag their own failures at the boundary (`kind`: `config` / `transient` / `ambiguous` / `rejected`); the chain skips unconfigured transports instantly, stops early on permanent rejections, and its single whole-chain retry fires only when every hop provably did not accept the message (an aggregate `transient` outcome).

## References

- ADR 0007: email verification and transport (hash-secrets invariant)
