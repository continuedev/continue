import { describe, expect, it } from "vitest";
import { toResponsesInput } from "./openaiTypeConverters";
import type { ChatMessage, ThinkingChatMessage } from "..";

describe("toResponsesInput - reasoning handling", () => {
  it("includes reasoning item when encrypted_content is present", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_abc123" },
          { type: "summary_text", text: "Thinking about sorting..." },
          { type: "encrypted_content", encrypted_content: "encrypted_blob" },
        ],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Use insertion sort.",
        metadata: { responsesOutputItemId: "msg_def456" },
      },
    ];

    const result = toResponsesInput(messages);

    // Both reasoning and assistant should be present
    expect(result).toHaveLength(2);

    const reasoningItem = result[0] as any;
    expect(reasoningItem.type).toBe("reasoning");
    expect(reasoningItem.id).toBe("rs_abc123");
    expect(reasoningItem.encrypted_content).toBe("encrypted_blob");

    const assistantItem = result[1] as any;
    expect(assistantItem.id).toBe("msg_def456");
  });

  it("skips reasoning and strips assistant id when encrypted_content missing and assistant references it", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_abc123" },
          { type: "summary_text", text: "Thinking about sorting..." },
          // NO encrypted_content - this is the bug case
        ],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Use insertion sort.",
        metadata: { responsesOutputItemId: "msg_def456" }, // HAS reference
      },
    ];

    const result = toResponsesInput(messages);

    // Reasoning should be skipped, assistant should NOT have id
    const reasoningItem = result.find((i: any) => i.type === "reasoning");
    expect(reasoningItem).toBeUndefined();

    // Assistant should be present but without the id (fallback format)
    expect(result).toHaveLength(1);
    const assistantItem = result[0] as any;
    // When id is stripped, it falls back to EasyInputMessage format
    expect(assistantItem.type).toBe("message");
    expect(assistantItem.role).toBe("assistant");
    expect(assistantItem.id).toBeUndefined();
  });

  it("keeps reasoning when encrypted_content missing but assistant has no reference", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_abc123" },
          { type: "summary_text", text: "Thinking about sorting..." },
          // NO encrypted_content
        ],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Use insertion sort.",
        // NO metadata.responsesOutputItemId - no reference!
      },
    ];

    const result = toResponsesInput(messages);

    // Reasoning should be KEPT (no reference means no risk of 400 error)
    const reasoningItem = result.find((i: any) => i.type === "reasoning");
    expect(reasoningItem).toBeDefined();
    expect((reasoningItem as any).id).toBe("rs_abc123");

    // Assistant should be present as EasyInputMessage (no id to begin with)
    expect(result).toHaveLength(2);
  });

  it("preserves tool calls when reasoning is skipped", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_abc" },
          // NO encrypted_content
        ],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_123",
            type: "function",
            function: { name: "search", arguments: '{"q":"test"}' },
          },
        ],
        metadata: { responsesOutputItemId: "msg_xyz" }, // HAS reference
      },
    ];

    const result = toResponsesInput(messages);

    // Reasoning should be skipped
    const reasoningItem = result.find((i: any) => i.type === "reasoning");
    expect(reasoningItem).toBeUndefined();

    // Tool call should still be present
    const toolCall = result.find((i: any) => i.type === "function_call");
    expect(toolCall).toBeDefined();
    expect((toolCall as any).name).toBe("search");
    expect((toolCall as any).call_id).toBe("call_123");
    // ID should be stripped since reasoning was skipped
    expect((toolCall as any).id).toBeUndefined();
  });

  it("handles multiple thinking/assistant pairs correctly", () => {
    const messages: ChatMessage[] = [
      // Turn 1: Has encrypted (good)
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_1" },
          { type: "encrypted_content", encrypted_content: "blob1" },
        ],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Response 1",
        metadata: { responsesOutputItemId: "msg_1" },
      },

      // Turn 2: No encrypted, HAS reference (should skip)
      {
        role: "thinking",
        content: "",
        reasoning_details: [{ type: "reasoning_id", id: "rs_2" }],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Response 2",
        metadata: { responsesOutputItemId: "msg_2" },
      },

      // Turn 3: No encrypted, NO reference (should keep)
      {
        role: "thinking",
        content: "",
        reasoning_details: [{ type: "reasoning_id", id: "rs_3" }],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Response 3",
        // NO responsesOutputItemId
      },

      { role: "user", content: "Follow up question" },
    ];

    const result = toResponsesInput(messages);

    // rs_1 should be present (has encrypted)
    const rs1 = result.find(
      (i: any) => i.type === "reasoning" && i.id === "rs_1",
    );
    expect(rs1).toBeDefined();

    // rs_2 should be SKIPPED (no encrypted + next has reference)
    const rs2 = result.find(
      (i: any) => i.type === "reasoning" && i.id === "rs_2",
    );
    expect(rs2).toBeUndefined();

    // rs_3 should be KEPT (no encrypted but next has no reference)
    const rs3 = result.find(
      (i: any) => i.type === "reasoning" && i.id === "rs_3",
    );
    expect(rs3).toBeDefined();

    // User message should be present
    const userMsg = result.find(
      (i: any) => i.role === "user" && i.content === "Follow up question",
    );
    expect(userMsg).toBeDefined();
  });

  it("handles thinking message at end of array (no next message)", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "",
        reasoning_details: [
          { type: "reasoning_id", id: "rs_orphan" },
          // NO encrypted_content
        ],
      } as ThinkingChatMessage,
      // No assistant message following
    ];

    const result = toResponsesInput(messages);

    // Should keep reasoning since there's no next message to reference it
    const reasoningItem = result.find((i: any) => i.type === "reasoning");
    expect(reasoningItem).toBeDefined();
  });

  it("handles empty reasoning_details", () => {
    const messages: ChatMessage[] = [
      {
        role: "thinking",
        content: "Some thinking content",
        reasoning_details: [],
      } as ThinkingChatMessage,
      {
        role: "assistant",
        content: "Response",
      },
    ];

    const result = toResponsesInput(messages);

    // Empty reasoning_details should result in no reasoning item
    const reasoningItem = result.find((i: any) => i.type === "reasoning");
    expect(reasoningItem).toBeUndefined();

    // Assistant should still be present
    expect(result).toHaveLength(1);
  });
});
