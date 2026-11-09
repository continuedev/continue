import { describe, expect, it, vi } from "vitest";
import {
  REVIEW_MAX_TOKENS,
  reviewCompletionOptions,
  reviewToolCall,
} from "./review";

describe("reviewCompletionOptions", () => {
  it("is temperature 0 and a short answer by default", () => {
    expect(reviewCompletionOptions()).toEqual({
      temperature: 0,
      maxTokens: REVIEW_MAX_TOKENS,
    });
  });

  it("adds the thinking budget on top of the answer when reasoning is on", () => {
    expect(
      reviewCompletionOptions({ reasoning: true, reasoningBudgetTokens: 4096 }),
    ).toEqual({
      temperature: 0,
      maxTokens: REVIEW_MAX_TOKENS + 4096,
      reasoning: true,
      reasoningBudgetTokens: 4096,
    });
  });

  it("turns reasoning off without changing the length", () => {
    expect(reviewCompletionOptions({ reasoning: false })).toEqual({
      temperature: 0,
      maxTokens: REVIEW_MAX_TOKENS,
      reasoning: false,
    });
  });
});

it("reviewToolCall sends the reasoning setting to the reviewer model", async () => {
  const chat = vi.fn(async (..._args: unknown[]) => ({
    role: "assistant",
    content: JSON.stringify({ decision: "allow", reason: "Fine." }),
  }));
  const result = await reviewToolCall(
    { chat } as any,
    {
      toolName: "run_terminal_command",
      args: { command: "npm test" },
      history: { userMessages: [], toolCalls: [] },
      environment: { workspaceDirs: [] },
    } as any,
    { reasoning: { reasoning: true, reasoningBudgetTokens: 1024 } },
  );
  expect(result.decision).toBe("allow");
  expect(chat.mock.calls[0][2]).toMatchObject({
    temperature: 0,
    maxTokens: REVIEW_MAX_TOKENS + 1024,
    reasoning: true,
    reasoningBudgetTokens: 1024,
  });
});
