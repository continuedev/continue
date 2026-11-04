import { describe, expect, it } from "vitest";
import { buildReviewHistory } from "./history";

describe("buildReviewHistory", () => {
  it("keeps user messages and call arguments, never agent text or output", () => {
    const history = [
      { message: { role: "user", content: "fix the bug" }, contextItems: [] },
      {
        message: { role: "assistant", content: "AGENT PROSE" },
        contextItems: [],
        toolCallStates: [
          {
            toolCall: { function: { name: "read_file", arguments: "" } },
            parsedArgs: { filepath: "a.ts" },
            output: [{ content: "TOOL OUTPUT SECRET" }],
          },
        ],
      },
      {
        message: {
          role: "user",
          content: [
            { type: "text", text: "now " },
            { type: "text", text: "run tests" },
          ],
        },
        contextItems: [],
      },
    ] as any;
    const r = buildReviewHistory(history);
    expect(r.userMessages).toEqual(["fix the bug", "now run tests"]);
    expect(r.toolCalls).toEqual([
      { name: "read_file", args: { filepath: "a.ts" } },
    ]);
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(JSON.stringify(r)).not.toContain("AGENT PROSE");
  });

  it("is empty for an empty conversation", () => {
    expect(buildReviewHistory([])).toEqual({ userMessages: [], toolCalls: [] });
  });
});
