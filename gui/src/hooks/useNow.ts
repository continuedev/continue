import { useEffect, useState } from "react";

const listeners = new Set<(now: number) => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const TICK_MS = 15_000;

function subscribe(listener: (now: number) => void): () => void {
  listeners.add(listener);
  // One interval serves every component, however many show the time.
  timer ??= setInterval(() => {
    const now = Date.now();
    listeners.forEach((l) => l(now));
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * The current time, refreshed about every 15 seconds, so a component that says
 * whether a cache is still warm keeps saying the right thing while idle. All
 * components share one timer: the tool list alone can have dozens of rows.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Catch up at once if the component sat idle between render and effect.
    setNow(Date.now());
    return subscribe(setNow);
  }, []);
  return now;
}
