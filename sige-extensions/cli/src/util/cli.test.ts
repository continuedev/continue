import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasSuppliedPrompt, isHeadlessMode, isServe } from "./cli.js";

describe("CLI utility functions", () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe("isHeadlessMode", () => {
    it("should return true when -p flag is present", () => {
      process.argv = ["node", "script.js", "-p", "test prompt"];
      expect(isHeadlessMode()).toBe(true);
    });

    it("should return true when --print flag is present", () => {
      process.argv = ["node", "script.js", "--print", "test prompt"];
      expect(isHeadlessMode()).toBe(true);
    });

    it("should return false when no print flag is present", () => {
      process.argv = ["node", "script.js", "other", "args"];
      expect(isHeadlessMode()).toBe(false);
    });
  });

  describe("isServe", () => {
    it("should return true when serve command is present", () => {
      process.argv = ["node", "script.js", "serve"];
      expect(isServe()).toBe(true);
    });

    it("should return false when serve command is not present", () => {
      process.argv = ["node", "script.js", "-p", "test"];
      expect(isServe()).toBe(false);
    });
  });

  describe("hasSuppliedPrompt", () => {
    it("should return true when prompt immediately follows -p", () => {
      process.argv = ["node", "script.js", "-p", "test prompt"];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return true when prompt immediately follows --print", () => {
      process.argv = ["node", "script.js", "--print", "test prompt"];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return true when prompt follows other flags after -p", () => {
      // This is the bug fix - handles cases like: cn -p --config my.yaml "Prompt"
      process.argv = [
        "node",
        "script.js",
        "-p",
        "--config",
        "my.yaml",
        "test prompt",
      ];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return true when prompt follows multiple flags after --print", () => {
      process.argv = [
        "node",
        "script.js",
        "--print",
        "--config",
        "my.yaml",
        "--model",
        "gpt-4",
        "test prompt",
      ];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return false when only flags and their values follow -p", () => {
      process.argv = ["node", "script.js", "-p", "--config", "my.yaml"];
      expect(hasSuppliedPrompt()).toBe(false);
    });

    it("should return false when only unknown flags follow -p", () => {
      process.argv = ["node", "script.js", "-p", "--some-flag"];
      expect(hasSuppliedPrompt()).toBe(false);
    });

    it("should return false when no -p or --print flag is present", () => {
      process.argv = ["node", "script.js", "test prompt"];
      expect(hasSuppliedPrompt()).toBe(false);
    });

    it("should return true when --prompt flag is present", () => {
      process.argv = ["node", "script.js", "-p", "--prompt"];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return false when --agent flag is present (agent slug is not a prompt)", () => {
      process.argv = ["node", "script.js", "-p", "--agent", "my-agent"];
      expect(hasSuppliedPrompt()).toBe(false);
    });

    it("should return false when -p is last argument with no prompt", () => {
      process.argv = ["node", "script.js", "-p"];
      expect(hasSuppliedPrompt()).toBe(false);
    });

    it("should handle quoted prompts with flags in between", () => {
      process.argv = [
        "node",
        "script.js",
        "-p",
        "--config",
        "my.yaml",
        "Explain this code",
      ];
      expect(hasSuppliedPrompt()).toBe(true);
    });

    it("should return false when prompt appears before -p flag", () => {
      process.argv = ["node", "script.js", "test prompt", "-p"];
      expect(hasSuppliedPrompt()).toBe(false);
    });
  });
});
