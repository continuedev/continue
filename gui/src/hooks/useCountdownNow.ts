import { useEffect, useState } from "react";
import { nextTickDelay } from "../util/promptCacheCountdown";

/**
 * The current time, refreshed only when the countdown text toward `expiresAt`
 * would change: every second in the last 10 minutes, every minute before that,
 * and once more just after expiry. It sleeps with one timeout at a time, so an
 * idle, cold, off or streaming cache (`enabled` false, or no expiry) runs no
 * timer at all.
 */
export function useCountdownNow(
  expiresAt: number | undefined,
  enabled = true,
): number {
  const [now, setNow] = useState(() => Date.now());
  const active = enabled && expiresAt !== undefined;

  // A new expiry (another request) or coming back from `enabled: false` means
  // the clock above may be stale; catch up before scheduling anything.
  useEffect(() => {
    if (active) setNow(Date.now());
  }, [active, expiresAt]);

  useEffect(() => {
    if (!enabled || expiresAt === undefined) return;
    const msLeft = expiresAt - now;
    if (msLeft <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), nextTickDelay(msLeft));
    return () => clearTimeout(id);
  }, [active, expiresAt, now]);

  return now;
}
