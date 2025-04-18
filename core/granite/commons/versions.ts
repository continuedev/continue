import { gte, valid } from "semver";

export const MIN_OLLAMA_VERSION = "0.6.5";

export function checkMinimumServerVersion(version: string): boolean {
  return gte(version, MIN_OLLAMA_VERSION);
}

export function isSemVer(version: string | undefined): boolean {
  return valid(version) !== null;
}
