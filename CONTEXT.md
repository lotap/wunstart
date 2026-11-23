# wunstart

The vocabulary below is the built app’s glossary: the words to use in copy and code names, starting with the terms the kit ships. **Extend it with your product’s domain language as you build.** Implementation mechanics live in the wunshot and wunstart skills; add a term here only when it shapes how the product or its code is named or described.

## Language

**Anon**:
A visitor with no account. Carries a durable anonymous identity, and becomes a User at sign-up.
_Avoid_: Guest

**Audience**:
Which surface a page serves: `external` for marketing, landing, and auth pages; `internal` for the signed-in app and developer docs. Route metadata declares it, and the root shell chooses the matching header and footer. The home route is adaptive: external for Anons, internal for Users. An unmatched URL resolves as adaptive for its 404; a not-found or error thrown inside a matched route keeps that route’s audience.
_Avoid_: Surface, chrome

**User**:
A person with an account: the identity behind sign-in and the subject of bans. Code and models say User; product copy may say “account”.

**Session**:
A single sign-in for a User, backed by a refresh/access token pair. The unit of revocation: signing out all ends every Session.

**Sudo**:
A short-lived privileged window unlocked by re-entering credentials. Code says Sudo; copy says “reverify”.

**Op**:
The unit of business logic in `src/db/ops`, invoked from server code through `runOp`.

**Activity**:
An append-only security log entry written by an Op: outcome, weight, IP, and credential.

**Weight**:
How strongly an Activity counts toward a Ban; a wrong password and a rate-limit denial carry different weight.

**Ban**:
A temporary block on one scope — IP, credential (the email the attempt claimed), User, or Anon — once weighted Activity crosses the threshold within a window.

**Auth attempt allowance**:
The fixed number of unauthenticated credential presentations one target — a client network or a claimed email — may make per window. It bounds the hashing work an attacker can force; it is not a Ban, which failure Weight still decides. When the allowance is spent, the request is denied before any hash.
_Avoid_: Attempt ceiling, attempt cap

**Archive**:
The app’s no-hard-delete guarantee: removed data leaves the live tables for an archive twin, so it disappears from the product while audit history survives. A derived counter records no fact the archive does not already hold, so it is swept instead.

**Email verification**:
Verify-before-create: a six-digit passcode authorizes User creation, so every User is verified by construction.

**Static image**:
A committed raster image imported with `?responsive` and emitted as AVIF variants at build time. Shared images live in `src/assets/images/<domain>`; private ones live in `-images` beside their owner.
_Avoid_: Image asset

**Public asset**:
A file under `public/` served unchanged at a stable URL. `?responsive` has no effect on it. Keep content images out of it.
_Avoid_: Static asset
