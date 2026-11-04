/** Thrown by [withTimeout] when the promise did not settle in time. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Settle with `promise`, or reject with a [TimeoutError] after `ms`. The
 * original promise is not cancelled; its result is ignored.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
