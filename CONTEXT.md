# wunstart

The vocabulary below is the built app’s glossary: the words to use in copy and code names, starting with the terms the kit ships. **Extend it with your product’s domain language as you build.** Implementation mechanics live in the wunshot and wunstart skills; add a term here only when it shapes how the product or its code is named or described.

## Language

**Anon**:
A visitor with no account. Carries a durable anonymous identity, and becomes a User at sign-up.
_Avoid_: Guest

**User**:
A person with an account: the identity behind sign-in and the subject of bans. Code and models say User; product copy may say “account”.

**Session**:
A single sign-in for a User, backed by a refresh/access token pair. The unit of revocation: signing out all ends every Session.

**Sudo**:
A short-lived privileged window unlocked by re-entering credentials. Code says Sudo; copy says “reverify”.

**Op**:
The unit of business logic in `src/db/ops`, invoked from server code through `runOp`.

**Activity**:
An append-only security log entry written by every Op: outcome, weight, IP, and credential.

**Weight**:
How strongly an Activity counts toward a Ban; a wrong password and a rate-limit denial carry different weight.

**Ban**:
A temporary block on one scope — IP, credential (the email the attempt claimed), User, or Anon — once weighted Activity crosses the threshold within a window.

**Archive**:
The app’s no-hard-delete guarantee: removed data leaves the live tables for an archive twin, so it disappears from the product while audit history survives.

**Email verification**:
Verify-before-create: a 6-digit passcode authorizes User creation, so every User is verified by construction.
