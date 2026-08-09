import { describe, expect, it } from "vitest";
import { SystemMessageToolCodeblocksFramework } from ".";
import { detectToolCallStart } from "../detectToolCallStart";

describe("detectToolCallStart", () => {
  let framework = new SystemMessageToolCodeblocksFramework();
  it("detects standard tool call start", () => {
    const buffer = "```tool\nTOOL_NAME: example_tool";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(true);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe(buffer);
  });

  it("detects tool_name start without codeblock", () => {
    const buffer = "tool_name: example_tool";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(true);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe("```tool\nTOOL_NAME: example_tool");
  });

  it("detects case-insensitive tool call start", () => {
    const buffer = "```ToOl\nTOOL_NAME: example_tool";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(true);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe(buffer);
  });

  it("detects case-insensitive tool_name start", () => {
    const buffer = "ToOl_NaMe: example_tool";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(true);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe("```tool\nTOOL_NAME: example_tool");
  });

  it("identifies partial tool call start", () => {
    const buffer = "```to";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(false);
    expect(result.isInPartialStart).toBe(true);
    expect(result.modifiedBuffer).toBe(buffer);
  });

  it("identifies partial tool_name start", () => {
    const buffer = "tool_na";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(false);
    expect(result.isInPartialStart).toBe(true);
    expect(result.modifiedBuffer).toBe(buffer);
  });

  it("does not detect tool call in unrelated text", () => {
    const buffer = "This is some regular text.";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(false);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe(buffer);
  });

  it("does not detect tool call in similar but different markdown block", () => {
    const buffer = "```javascript\nconst x = 10;";
    const result = detectToolCallStart(buffer, framework);

    expect(result.isInToolCall).toBe(false);
    expect(result.isInPartialStart).toBe(false);
    expect(result.modifiedBuffer).toBe(buffer);
  });
});
