import { describe, expect, it } from "vitest";

import {
  getPermissionDeniedMessage,
  resolveUserPermissionResult,
} from "./toolPermissionResult.js";

describe("tool permission result", () => {
  it("reports a missing interactive callback instead of a user denial", () => {
    const result = resolveUserPermissionResult(undefined);

    expect(result).toEqual({
      approved: false,
      denialReason: "callback_missing",
    });
    expect(getPermissionDeniedMessage(result.denialReason!)).toBe(
      "Interactive permission prompt unavailable",
    );
  });
});
