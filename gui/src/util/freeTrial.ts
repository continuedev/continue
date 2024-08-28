import { getLocalStorage } from "./localStorage";

export const FREE_TRIAL_LIMIT_REQUESTS = 50;

/**
 *
 * @returns {boolean} true if the user has passed the free trial limit, false otherwise.
 */
export function hasPassedFTL(): boolean {
  return (getLocalStorage("ftc") ?? 0) > FREE_TRIAL_LIMIT_REQUESTS;
}
