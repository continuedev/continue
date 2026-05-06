/**
 * Sentry configuration constants.
 *
 * The DSN is read from the YUTOAGENTIC_SENTRY_DSN env var. When unset (the
 * default in this fork), error reporting is disabled.
 */
export const SENTRY_DSN: string = process.env.YUTOAGENTIC_SENTRY_DSN ?? "";
