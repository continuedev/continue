import { expect, test } from "vitest";
import { toResponsesInput } from "./openaiTypeConverters";
import { ChatMessage } from "..";

test("toResponsesInput pairs reasoning with subsequent items", () => {
  const messages: ChatMessage[] = [
    {
      role: "thinking",
      content: "Thinking...",
      metadata: { reasoningId: "rs1", encrypted_content: "enc1" },
    },
    {
      role: "assistant",
      content: "Hello",
      metadata: { responsesOutputItemId: "msg1" },
    },
  ];

  const input = toResponsesInput(messages);

  const reasoningItem = input.find(
    (item) => (item as any).type === "reasoning",
  );
  const messageItem = input.find((item) => (item as any).type === "message");

  expect(reasoningItem).toBeDefined();
  expect(messageItem).toBeDefined();
  expect((messageItem as any).reasoning).toBe("rs1");
});

test("toResponsesInput pairs reasoning with multiple tool calls", () => {
  const messages: ChatMessage[] = [
    {
      role: "thinking",
      content: "Thinking about tools...",
      metadata: { reasoningId: "rs2", encrypted_content: "enc2" },
    },
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "call1",
          type: "function",
          function: { name: "test", arguments: "{}" },
        },
      ],
      metadata: { responsesOutputItemIds: ["fc1"] },
    },
  ];

  const input = toResponsesInput(messages);

  const toolCallItem = input.find(
    (item) => (item as any).type === "function_call",
  );
  expect(toolCallItem).toBeDefined();
  expect((toolCallItem as any).reasoning).toBe("rs2");
});
