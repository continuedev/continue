
/**
 * Recursively retrieves the root cause of an error by traversing through its `cause` property.
 *
 * @param err - The error object to analyze. It can be of any type.
 * @returns The root cause of the error, or the original error if no further cause is found.
 */
export function getRootCause(err: any): any {
    if (err.cause) {
      return getRootCause(err.cause);
    }
    return err;
}