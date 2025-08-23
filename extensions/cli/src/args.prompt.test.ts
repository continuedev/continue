import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { parseArgs, processPromptOrRule } from "./args.js";

describe("args --prompt flag", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    // Reset process.argv for each test
    process.argv = ["node", "script.js"];
  });

  afterAll(() => {
    // Restore original process.argv after all tests
    process.argv = originalArgv;
  });

  it("should parse single prompt from --prompt flag", () => {
    process.argv = ["node", "script.js", "--prompt", "my-prompt"];
    const result = parseArgs();
    expect(result.prompts).toEqual(["my-prompt"]);
  });

  it("should parse multiple prompts from multiple --prompt flags", () => {
    process.argv = [
      "node",
      "script.js",
      "--prompt",
      "prompt1",
      "--prompt",
      "prompt2",
    ];
    const result = parseArgs();
    expect(result.prompts).toEqual(["prompt1", "prompt2"]);
  });

  it("should handle mixed flags including --prompt", () => {
    process.argv = [
      "node",
      "script.js",
      "--config",
      "myconfig",
      "--prompt",
      "myprompt",
      "--resume",
    ];
    const result = parseArgs();
    expect(result.configPath).toBe("myconfig");
    expect(result.prompts).toEqual(["myprompt"]);
    expect(result.resume).toBe(true);
  });

  it("should not include --prompt value in non-flag arguments", () => {
    process.argv = [
      "node",
      "script.js",
      "--prompt",
      "prompt-value",
      "actual-prompt",
    ];
    const result = parseArgs();
    expect(result.prompts).toEqual(["prompt-value"]);
    expect(result.prompt).toBe("actual-prompt");
  });

  it("should handle both --rule and --prompt flags", () => {
    process.argv = [
      "node",
      "script.js",
      "--rule",
      "my-rule",
      "--prompt",
      "my-prompt",
    ];
    const result = parseArgs();
    expect(result.rules).toEqual(["my-rule"]);
    expect(result.prompts).toEqual(["my-prompt"]);
  });

  it("should process direct string content", async () => {
    const result = await processPromptOrRule("This is a direct prompt");
    expect(result).toBe("This is a direct prompt");
  });
});
