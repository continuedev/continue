export const MIN_OLLAMA_VERSION = "0.6.5";

// copied from packages/config-yaml/src/schemas/data/index.ts
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function isSemVer(version: string | undefined): boolean {
  return version !== undefined && SEMVER_REGEX.test(version);
}

/**
 * Compares two version strings and returns a number indicating their order.
 *
 * @param v1 - The first version string to compare.
 * @param v2 - The second version string to compare.
 * @returns A number indicating the order of the versions:
 *          - `1` if `v1` is greater than `v2`
 *          - `-1` if `v1` is less than `v2`
 *          - `0` if `v1` is equal to `v2`
 *
 * The function first checks if the versions are valid semantic versions (SemVer).
 * If both versions are SemVer, it compares their major, minor, and patch parts.
 * If the versions have pre-release identifiers, it compares them as well.
 * If neither version is SemVer, it returns `0`.
 */
export function compareVersions(v1: string, v2: string): number {
  if (isSemVer(v1)) {
    if (!isSemVer(v2)) {
      return 1;
    }
  } else if (isSemVer(v2)) {
    return -1;
  } else {
    return 0;
  }
  const parseVersion = (version: string) => {
    const [main, pre] = version.split("-");
    const [major, minor, patch] = main.split(".").map(Number);
    const preRelease = pre ? pre.split(".") : [];
    return { major, minor, patch, preRelease };
  };

  const compareParts = (a: number, b: number): number => a - b;

  const comparePreRelease = (pre1: string[], pre2: string[]): number => {
    if (pre1.length === 0 && pre2.length > 0) {
      return 1; // v1 is stable, v2 is pre-release
    }
    if (pre1.length > 0 && pre2.length === 0) {
      return -1; // v1 is pre-release, v2 is stable
    }

    for (let i = 0; i < Math.max(pre1.length, pre2.length); i++) {
      const part1 = pre1[i] ?? ""; // Default to empty string if missing
      const part2 = pre2[i] ?? "";

      const num1 = Number(part1);
      const num2 = Number(part2);

      if (!isNaN(num1) && !isNaN(num2)) {
        if (num1 !== num2) {
          return num1 - num2;
        }
      } else {
        const result = part1.localeCompare(part2);
        if (result !== 0) {
          return result;
        }
      }
    }
    return 0;
  };

  const v1Parts = parseVersion(v1);
  const v2Parts = parseVersion(v2);
  let result = compareParts(v1Parts.major, v2Parts.major);
  if (result !== 0) {
    return result;
  }
  result = compareParts(v1Parts.minor, v2Parts.minor);
  if (result !== 0) {
    return result;
  }
  result = compareParts(v1Parts.patch, v2Parts.patch);
  if (result !== 0) {
    return result;
  }
  return comparePreRelease(v1Parts.preRelease, v2Parts.preRelease);
}
