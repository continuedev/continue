import { describe, expect, test } from "vitest";
import { runTerminalCommandTool } from "./runTerminalCommand";

describe("runTerminalCommandTool policy", () => {
  test("does not prompt for high-risk commands when explicitly automatic", () => {
    expect(
      runTerminalCommandTool.evaluateToolCallPolicy?.(
        "allowedWithoutPermission",
        { command: "python -m pytest" },
      ),
    ).toBe("allowedWithoutPermission");
  });

  test("still disables critical commands when explicitly automatic", () => {
    expect(
      runTerminalCommandTool.evaluateToolCallPolicy?.(
        "allowedWithoutPermission",
        { command: "sudo apt-get update" },
      ),
    ).toBe("disabled");
  });

  test("preserves security prompts in ask-first mode", () => {
    expect(
      runTerminalCommandTool.evaluateToolCallPolicy?.("allowedWithPermission", {
        command: "python -m pytest",
      }),
    ).toBe("allowedWithPermission");
  });
});
