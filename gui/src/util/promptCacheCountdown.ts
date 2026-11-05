/**
 * Pure pieces of the prompt-cache countdown in the toolbar: the text, the ring
 * fill, and how long to wait before the text next changes. Kept apart from
 * promptCache.ts so that file can import the clock formatter without a cycle.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Below this the text counts seconds ("4:12"); at or above it, minutes ("42m"). */
export const COUNTDOWN_SECONDS_BELOW_MS = 10 * MINUTE;

/** The ring and text turn to the warning color in the last minute. */
export const COUNTDOWN_WARN_MS = MINUTE;

/**
 * Time left as short toolbar text: "45s", "4:12", "42m". Rounds up, so the
 * text never reads 0 while the entry is still alive and never shows less than
 * is left.
 */
export function formatCountdown(msLeft: number): string {
  if (msLeft >= COUNTDOWN_SECONDS_BELOW_MS) {
    return `${Math.ceil(msLeft / MINUTE)}m`;
  }
  const total = Math.max(1, Math.ceil(msLeft / SECOND));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** How full the ring is, from 1 (just written) to 0 (expired). */
export function ringFraction(msLeft: number, lifetimeMs: number): number {
  if (lifetimeMs <= 0) return 0;
  return Math.min(1, Math.max(0, msLeft / lifetimeMs));
}

/**
 * Milliseconds until `formatCountdown(msLeft)` next returns something else, so
 * a component can sleep exactly that long instead of polling. Always at least 1.
 */
export function nextTickDelay(msLeft: number): number {
  if (msLeft <= 0) return 1;
  if (msLeft >= COUNTDOWN_SECONDS_BELOW_MS) {
    // The text is ceil(minutes), so it changes once msLeft drops to the
    // previous whole minute. Counting switches to seconds just below 10 min.
    const next = Math.max(
      (Math.ceil(msLeft / MINUTE) - 1) * MINUTE,
      COUNTDOWN_SECONDS_BELOW_MS - 1,
    );
    return msLeft - next;
  }
  const next = (Math.ceil(msLeft / SECOND) - 1) * SECOND;
  // At 0 the entry has expired; wake just after so the caller sees it cold.
  return next > 0 ? msLeft - next : msLeft + 1;
}

/** Wall-clock time in the user's locale, for the tooltip: "3:42 PM". */
export function formatClockTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
    new Date(ms),
  );
}
