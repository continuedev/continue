import type { RequestOptions as BaseRequestOptions } from "@continuedev/config-types";

/**
 * `RequestOptions` plus `useSystemCa`. This package depends on the published
 * `@continuedev/config-types`, which may not declare the newer option yet.
 */
export type RequestOptions = BaseRequestOptions & {
  /** Also trust the OS certificate store (default: on for Windows and macOS). */
  useSystemCa?: boolean;
};
