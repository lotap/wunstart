/**
 * Request a passcode for either a new account or an existing account. The
 * request path is shared by sign-up and sign-in, so the chart takes the
 * originating form instead of implying one flow.
 */
export const requestPasscodeChart = (formPath: string) => `flowchart LR
  form(["${formPath}"]) -->|"email + intent"| fn["handleEmailRequestPasscode"]
  fn -->|"rate limit"| rl["rateLimit"] -->|"runOp"| op["emailRequestPasscode"]
  fn -->|"runOp · if unregistered"| reg["registerAnon"] -->|"insert"| anons[("anons")]
  reg -->|"log"| logs[("activities · bans")]
  reg -.->|"registered anon · Set-Cookie"| cookie[/"anon cookie"/]
  op -->|"pre-check"| logs
  op -->|"lookup recipient"| users[("users")]
  op -->|"upsert code"| verifications[("email_verifications")]
  op -->|"hash code"| hash{{"AuthHasher DO"}}
  op -->|"send"| mail{{"EmailService"}}
  op -->|"send fails"| failedArchive[("email_verifications_archive")]
  op -->|"log"| logs`

/**
 * Verify a passcode. The op branches on whether the email already belongs to a
 * user: existing users get a session, unknown emails create the user and session.
 * Both branches burn the verification row and archive the Anon.
 */
export const verifyPasscodeChart = (formPath: string) => `flowchart LR
  form(["${formPath}"]) -->|"email + passcode"| fn["handleEmailVerifyPasscode"]
  fn -->|"rate limit + requireAnonRegistered"| mw["rateLimit · requireAnonRegistered"] -->|"runOp"| op["emailVerifyPasscode"]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"lookup / create"| account[("users · sessions")]
  op -->|"verify code"| verifications[("email_verifications")]
  op -->|"verify hash"| hash{{"AuthHasher DO"}}
  op -->|"wrong / expired"| retry["count attempt · archive at 4"]
  op -->|"burn code"| archive[("email_verifications_archive")]
  op -->|"create session"| sessions[("sessions")]
  op -->|"retire anon"| anons[("anons · anons_archive")]
  op -->|"nonce hash"| hash
  op -->|"access JWE"| secrets{{"authLayer secrets"}}
  op -->|"notify existing"| mail{{"EmailService"}}
  op -->|"log"| logs
  fn -.->|"Set-Cookie: access + refresh · clear anon"| cookie[/"auth cookies"/]`

/** Password sign-in: verify the password, create a session, rotate the Anon, issue tokens. */
export const passwordSignInChart = `flowchart LR
  form(["/sign-in"]) -->|"email + password"| fn["handlePasswordSignIn"]
  fn -->|"rate limit + requireAnon"| mw["rateLimit · requireAnon"] -->|"runOp"| op["passwordSignIn"]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"lookup / rehash"| account[("users · sessions")]
  op -->|"verify password"| hash{{"AuthHasher DO"}}
  op -->|"nonce hash"| hash
  op -->|"access JWE"| secrets{{"authLayer secrets"}}
  op -->|"create session"| sessions[("sessions")]
  op -->|"retire anon"| anons[("anons · anons_archive")]
  op -->|"notify"| mail{{"EmailService"}}
  op -->|"log"| logs
  fn -.->|"Set-Cookie: access + refresh · clear anon"| cookie[/"auth cookies"/]`

/** Successful access-token verification is stateless: decrypt the JWE, trust the payload, skip Postgres. */
export const verifyAccessChart = `flowchart LR
  request(["HTTP request"]) -->|"auth middleware"| verify["verifyAuth"]
  cookie[/"access cookie"/] -->|"JWE"| verify
  verify -->|"runOp"| op["verifyAccess"]
  op -->|"decrypt / validate"| secrets{{"authLayer secrets"}}
  op -->|"userId · sudoExpiresAt"| context["server fn context"]`

/**
 * Refresh only runs when the access token is missing or invalid. The current
 * generation rotates the session; one generation behind replays through the
 * grace token, and older tokens revoke the session.
 */
export const refreshChart = `flowchart LR
  request(["HTTP request"]) -->|"invalid access"| verify["verifyAuth"]
  cookie[/"refresh cookie"/] -->|"JWS"| verify
  verify -->|"runOp"| op["refresh"]
  op -->|"load session"| sessions[("sessions")]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"current generation"| rotate["verify nonce · CAS rotate"]
  rotate -->|"AuthHasher DO"| hash{{"AuthHasher DO"}}
  rotate -->|"new access + refresh"| nextCookie[/"access + refresh cookies"/]
  op -->|"one generation behind"| grace["grace replay"] -->|"new tokens"| nextCookie
  op -->|"older / expired grace"| revoke["revoke session"] -->|"notify"| mail{{"EmailService"}}
  op -->|"invalid / future"| clear["verifyAuth clears both cookies"]
  op -->|"log"| logs
  verify -->|"refresh ok"| context["server fn context"]`

/** Sign out one session or every session, then replace the auth cookies with an Anon. */
export const signOutChart = `flowchart LR
  menu(["/settings · user menu"]) -->|"this device"| outFn["handleSignOut"] --> authOut["requireAuth"] -->|"runOp"| outOp["signOut"]
  outOp -->|"refresh JWS"| secrets{{"authLayer secrets"}}
  outOp -->|"verify nonce"| hash{{"AuthHasher DO"}}
  outOp -->|"read"| active[("sessions")]
  outOp -->|"archive"| sessions[("sessions_archive")]
  outOp -->|"log"| logs[("activities · bans")]
  outFn -.->|"refresh in · clear auth · set anon"| cookie[/"Set-Cookie"/]
  menu -->|"all devices"| allFn["handleSignOutAll"] --> authAll["requireAuth"] -->|"runOp"| allOp["signOutAll"]
  allOp -->|"access JWE"| secrets{{"authLayer secrets"}}
  allOp -->|"archive by user"| sessions
  allOp -->|"log"| logs
  allFn -.->|"access in · clear auth · set anon"| cookie`

/** A fresh password check mints a short sudo lease; the change op consumes it. */
export const passwordChangeChart = `flowchart LR
  form(["/settings"]) -->|"current password"| reverifyFn["handlePasswordReverify"]
  reverifyFn -->|"rate limit + requireAuth"| mw1["rateLimit · requireAuth"] -->|"runOp"| reverifyOp["passwordReverify"]
  reverifyOp -->|"pre-check"| logs[("activities · bans")]
  reverifyOp -->|"verify / rehash"| users[("users")]
  reverifyOp -->|"verify / rehash"| hash{{"AuthHasher DO"}}
  reverifyOp -->|"fresh sudo · access JWE"| access[/"access cookie"/]
  reverifyOp -->|"log"| logs
  form -->|"new password"| changeFn["handlePasswordChange · strength check"]
  changeFn -->|"rate limit + requireAuth"| mw2["rateLimit · requireAuth"] -->|"runOp"| changeOp["passwordChange"]
  changeOp -->|"pre-check"| logs
  changeOp -->|"sudo lease · stale fails"| sudo{"sudoExpiresAt"}
  changeOp -->|"update hash"| users
  changeOp -->|"hash new password"| hash
  changeOp -->|"optional: archive all"| sessionArchive[("sessions · sessions_archive")]
  changeOp -->|"optional: anon token"| anon[/"anon cookie"/]
  changeOp -->|"confirm"| mail{{"EmailService"}}
  changeOp -->|"log"| logs
  changeFn -.->|"read sudo · optionally clear auth · set anon"| access`

/** Project-wide guards: in-memory request limiting plus database-backed bans. */
export const guardrailsChart = `flowchart LR
  request(["Server fn request"]) -->|"150/min global · 5/min auth"| mw["rateLimit · in-memory IP"]
  mw -->|"over limit"| denied["429"]
  mw -->|"server fn"| op["runOp · createOpsFn"]
  op -->|"credential ops"| check["checkCurrentBansAndExcessiveActivities"]
  check --> bans[("bans")]
  check --> activities[("activities")]
  op -->|"success / failure"| log["logActivityAndHandleBans"]
  log --> activities
  log -->|"extend / create"| bans
  op -->|"RateLimitError"| weight["extra IP weight"] --> denied`
