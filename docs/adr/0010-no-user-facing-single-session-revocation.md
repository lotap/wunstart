# ADR 0010: No user-facing single-session revocation

**Status**: Accepted  
**Date**: 2026-08-31

Sessions are listed for the account owner (see the settings page) with device
and geolocation context, but there is deliberately **no user-facing endpoint or
button to revoke an individual session**. The account holder's eviction tool is
`signOutAll`, which revokes every session including their own.

## Context

Per-session revocation is the industry norm (Google, GitHub, etc.), and the
sessions list makes it a natural feature request. The question is whether the
account holder should be able to kill session X while keeping session Y.

The threat model splits cleanly by what the attacker holds:

- **Attacker knows the credentials**: the account is lost regardless. They can
  change the email, wait out any protection, or re-authenticate after any
  eviction. No session-revocation UX changes this.
- **Attacker holds a stolen cookie only** (the majority of real-world session
  hijacks): today, `signOutAll` is self-limiting for them — it revokes their
  stolen session too, and without credentials they cannot return. The victim
  always has a working response: spot the foreign session, sign out all.

## Rationale

A user-facing per-session revoke would break that second case: an attacker
script ("watcher") could keep its own stolen session alive while auto-revoking
every session the legitimate user creates, indefinitely and silently. The harm
is not direct escalation — the attacker already has access — but that the
lockout **neutralizes `signOutAll`, the victim's primary defense**, preserving
the attacker's access rather than just denying the victim.

Every current recovery path either creates a session (email passcode sign-in —
revoked by the watcher) or requires one (password change under sudo — revoked
before use). Against a revocation loop, the victim can only race. Real products
ship per-session revocation safely because unauthenticated, email-verified
account recovery exists and cannot be blocked by session revocation. This app
does not have that yet (see ADR 0007 for the email infrastructure it would
build on).

Meanwhile the feature's benefit is convenience only: `signOutAll` + re-login on
one or two devices serves the legitimate "revoke just that device" case, and
sessions expire on their own after 30 days. Selective revocation already exists
where it is genuinely needed and cannot be abused by whoever holds a live
cookie: refresh-token reuse detection (`revokeForReuse`) revokes individual
sessions server-side and emails the owner (ADR 0001).

## Decision

1. Ship the sessions list (visibility is the victim's detection tool) and keep
   `signOutAll` as the only user-facing eviction tool.
2. Do not expose single-session revocation to authenticated callers.
3. Revisit per-session revocation alongside an unauthenticated, email-verified
   recovery flow. With that in place, the watcher loop becomes unwinnable for
   the attacker (victim resets credentials without needing a session), and the
   feature can ship with mitigations: notification email on remote revocation,
   a per-user revocation rate limit, and revoke-others-only semantics.
