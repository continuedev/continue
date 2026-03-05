/**
 * Defensive tests for Bug 4 (GitHub Issue: TBD):
 * New agent configs should trigger refreshAll, not reloadConfig.
 *
 * When a new assistant file is created via config/newAssistantFile, the handler
 * in core/core.ts should call refreshAll() (which rebuilds the profile list
 * including new agent files) rather than reloadConfig() (which only reloads
 * the current profile).
 *
 * The FAILING test reads the source of core.ts and asserts the handler calls
 * refreshAll. This is a source-level assertion — brittle, but precisely tests
 * the one-line bug at core/core.ts:406.
 *
 * The fix: change line 406 from this.configHandler.reloadConfig(...)
 * to this.configHandler.refreshAll(...).
 */
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { isContinueAgentConfigFile } from "./loadLocalAssistants";

describe("config/newAssistantFile handler should call refreshAll", () => {
  /**
   * FAILS NOW — this is the defensive test for Bug 4.
   *
   * Reads core.ts source and checks that the config/newAssistantFile handler
   * calls refreshAll (not reloadConfig). This is a static analysis test.
   */
  it("handler should call refreshAll, not reloadConfig", () => {
    const coreSource = fs.readFileSync(
      path.resolve(__dirname, "../core.ts"),
      "utf-8",
    );

    // Extract the config/newAssistantFile handler block.
    // The pattern matches: on("config/newAssistantFile", async (msg) => { ... });
    const handlerMatch = coreSource.match(
      /on\(\s*"config\/newAssistantFile"[\s\S]*?\}\);/,
    );
    expect(handlerMatch).toBeTruthy();

    const handlerBody = handlerMatch![0];

    // FAILS NOW: handler calls reloadConfig instead of refreshAll
    expect(handlerBody).toContain("refreshAll");
    expect(handlerBody).not.toContain("reloadConfig");
  });
});

// --- Passing tests below document isContinueAgentConfigFile behavior ---

describe("isContinueAgentConfigFile", () => {
  it("should identify .continue/agents/ YAML files as agent configs", () => {
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/agents/new-config.yaml",
      ),
    ).toBe(true);
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/agents/my-agent.yml",
      ),
    ).toBe(true);
  });

  it("should identify .continue/assistants/ YAML files as agent configs", () => {
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/assistants/config.yaml",
      ),
    ).toBe(true);
  });

  it("should not match non-YAML files in agents directory", () => {
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/agents/readme.md",
      ),
    ).toBe(false);
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/agents/config.json",
      ),
    ).toBe(false);
  });

  it("should not match YAML files outside agents/assistants directories", () => {
    expect(
      isContinueAgentConfigFile(
        "file:///workspace/.continue/rules/my-rule.yaml",
      ),
    ).toBe(false);
    expect(
      isContinueAgentConfigFile("file:///workspace/.continue/config.yaml"),
    ).toBe(false);
  });

  it("should not match non-.continue YAML files", () => {
    expect(
      isContinueAgentConfigFile("file:///workspace/src/config.yaml"),
    ).toBe(false);
  });
});
