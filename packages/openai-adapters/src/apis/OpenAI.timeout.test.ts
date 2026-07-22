import { describe, expect, it } from "vitest";

import { timeoutSecondsToMs } from "./OpenAI.js";

describe("timeoutSecondsToMs", () => {
  it("converts a seconds timeout to milliseconds", () => {
    expect(timeoutSecondsToMs(300)).toBe(300_000);
  });

  it("returns undefined when no timeout is provided", () => {
    expect(timeoutSecondsToMs(undefined)).toBeUndefined();
  });

  it("treats a 0 timeout as unset so the SDK default applies", () => {
    expect(timeoutSecondsToMs(0)).toBeUndefined();
  });
});
