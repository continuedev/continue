/**
 * Concurrency and request staggering for parallel subagents. Pure and
 * environment-free, so the gui (which runs the subagents) and tests share it.
 */

/** Subagents that may run at once; more wait their turn as "queued". */
export const MAX_CONCURRENT_SUBAGENTS = 3;

/**
 * How long a sibling waits for the first request with the same prefix to
 * start answering before it sends its own anyway.
 */
export const PREFIX_WAIT_MS = 15_000;

/** A counting semaphore whose waiters can give up when their run is cancelled. */
export class Semaphore {
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  get running(): number {
    return this.active;
  }

  /**
   * Resolves with a release function once a slot is free. Rejects if the
   * signal aborts first; nothing needs releasing then.
   */
  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(abortError(signal));
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.active--;
      this.waiters.shift()?.();
    };
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve(release);
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener("abort", onAbort);
        this.active++;
        resolve(release);
      };
      const onAbort = () => {
        this.waiters = this.waiters.filter((w) => w !== grant);
        reject(abortError(signal!));
      };
      this.waiters.push(grant);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error("Aborted");
}

/**
 * Prompt caches (Bedrock and Anthropic) store an entry only once a request's
 * response has started: requests with the same prefix sent before that each
 * write their own entry. So when several subagents with the same model,
 * system prompt and tools start together, the first one's request goes out
 * alone and the others wait until it starts answering (or fails, or a timeout
 * passes), then read its cache entry instead of writing N copies.
 *
 * Only the first request of each run waits; later ones are spaced by tool
 * calls anyway.
 */
export class PrefixGate {
  private leaders = new Map<string, Promise<void>>();

  constructor(private readonly maxWaitMs = PREFIX_WAIT_MS) {}

  /**
   * Call before a run's first request. Resolves with `opened`, which the
   * caller must call once the response starts (or the request fails); the
   * first caller for a key gets through at once, later ones wait for it.
   */
  async enter(
    key: string,
    signal?: AbortSignal,
  ): Promise<{ opened: () => void; waited: boolean }> {
    const leader = this.leaders.get(key);
    if (!leader) {
      let open!: () => void;
      const started = new Promise<void>((resolve) => (open = resolve));
      this.leaders.set(key, started);
      let done = false;
      const opened = () => {
        if (done) return;
        done = true;
        open();
      };
      // A later batch with the same prefix finds the entry warm and need not
      // wait, so the key only gates while the leader's request is pending.
      void started.then(() => {
        if (this.leaders.get(key) === started) this.leaders.delete(key);
      });
      return { opened, waited: false };
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, this.maxWaitMs);
      signal?.addEventListener("abort", finish, { once: true });
      void leader.then(finish);
      function finish() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      }
    });
    return { opened: () => {}, waited: true };
  }
}
