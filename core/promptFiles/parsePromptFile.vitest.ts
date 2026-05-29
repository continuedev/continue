import { describe, expect, it } from "vitest";

import { parsePromptFile } from "./parsePromptFile.js";

describe("parsePromptFile", () => {
  it("extracts the system message when both tags are present", () => {
    const result = parsePromptFile(
      "greeting.prompt",
      "<system>You are helpful</system>\nSummarize the file",
    );

    expect(result.systemMessage).toBe("You are helpful");
    expect(result.prompt).toBe("Summarize the file");
  });

  it("does not throw when <system> has no closing tag", () => {
    const content = "<system>You forgot to close the tag\nSummarize the file";

    expect(() => parsePromptFile("broken.prompt", content)).not.toThrow();

    const result = parsePromptFile("broken.prompt", content);
    expect(result.systemMessage).toBeUndefined();
    expect(result.prompt).toBe(content);
  });

  it("leaves the prompt untouched when there is no system block", () => {
    const result = parsePromptFile("plain.prompt", "Just a prompt body");

    expect(result.systemMessage).toBeUndefined();
    expect(result.prompt).toBe("Just a prompt body");
  });
});
