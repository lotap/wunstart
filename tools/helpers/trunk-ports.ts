// Trunk's mailpit ports (SMTP for external mail clients, HTTP for the
// app's MAILPIT_URL; compose defaults for every branch). This module
// exists ONLY because both sides of the phase/helpers boundary import
// from it — branch-env's claim scan uses the pair, validate-setup's trunk
// expectation uses HTTP. Split or duplicate them and the scan and the
// health check disagree about trunk.
// Residency rule (AGENTS.md Placement): single-consumer values stay with
// their consumer; do not add values used by only one side. That is why this
// module holds exactly two constants.

/** Mailpit's SMTP port for external mail clients (compose default for every branch). */
export const MAILPIT_SMTP_WANT = 1025

/** Mailpit's HTTP port (the app's MAILPIT_URL; compose default for every branch). */
export const MAILPIT_HTTP_WANT = 8025
