import { beforeEach, describe, expect, it } from "vitest";
import { SystemMessageToolCodeblocksFramework } from ".";
import { AssistantChatMessage, ChatMessage, PromptLog } from "../../..";
import { interceptSystemToolCalls } from "../interceptSystemToolCalls";

describe("interceptSystemToolCalls", () => {
  let abortController: AbortController;
  let framework = new SystemMessageToolCodeblocksFramework();

  beforeEach(() => {
    abortController = new AbortController();
  });

  const createAsyncGenerator = async function* (
    messages: ChatMessage[][],
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    for (const messageGroup of messages) {
      yield messageGroup;
    }
    return undefined;
  };

  it("passes through non-assistant messages unchanged", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "user", content: "Hello" }],
      [{ role: "system", content: "System message" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    let result = await generator.next();
    expect(result.value).toEqual([{ role: "user", content: "Hello" }]);

    result = await generator.next();
    expect(result.value).toEqual([
      { role: "system", content: "System message" },
    ]);

    result = await generator.next();
    expect(result.done).toBe(true);
  });

  it("passes through assistant messages with existing tool calls", async () => {
    const messages: ChatMessage[][] = [
      [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              type: "function",
              function: {
                name: "existing_tool",
                arguments: '{"arg1":"value1"}',
              },
              id: "existing_call_id",
            },
          ],
        },
      ],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    const result = await generator.next();
    expect(result.value).toEqual(messages[0]);
  });

  it("passes through assistant messages with image URLs unchanged", async () => {
    const messages: ChatMessage[][] = [
      [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here's an image:" },
            {
              type: "imageUrl",
              imageUrl: {
                url: "https://example.com/image.png",
              },
            },
          ],
        },
      ],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    const result = await generator.next();
    expect(result.value).toEqual(messages[0]);
  });

  it("processes standard tool call format", async () => {
    const messages: ChatMessage[][] = [
      [
        {
          role: "assistant",
          content: "I'll help you with that. Let me use a tool:\n",
        },
      ],
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: arg1\n" }],
      [{ role: "assistant", content: "value1\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
      [{ role: "assistant", content: "```" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    // First chunk should be normal text
    let result = await generator.next();
    expect(result.value).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'll help you with that. Let me use a tool:",
          },
        ],
      },
    ]);

    result = await generator.next();
    expect(result.value).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "\n",
          },
        ],
      },
    ]);

    // Tool name detection
    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function?.name,
    ).toBe("test_tool");

    // Begin argument
    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toContain('{"arg1":');

    // Argument value
    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe('"value1"');

    // End of tool call
    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe("}");
  });

  it("processes tool_name without codeblock format at response start", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: arg1\n" }],
      [{ role: "assistant", content: "value1\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    // The system should detect the tool_name format and convert it
    let result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function?.name,
    ).toBe("test_tool");

    // Rest of processing should work as normal
    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe('{"arg1":');

    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe('"value1"');

    result = await generator.next();
    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe("}");
  });

  it("still detects canonical ```tool blocks after assistant text", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "Let me check that for you.\n" }],
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    await generator.next();
    await generator.next();
    const result = await generator.next();

    expect(
      (result.value as AssistantChatMessage[])[0].toolCalls?.[0].function?.name,
    ).toBe("test_tool");
  });

  it("does not treat quoted TOOL_NAME lines as real tool calls", async () => {
    const messages: ChatMessage[][] = [
      [
        {
          role: "assistant",
          content:
            "Use this format when you call a tool:\nTOOL_NAME: read_file\nBEGIN_ARG: path\nREADME.md\nEND_ARG",
        },
      ],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    const chunks: ChatMessage[][] = [];
    while (true) {
      const result = await generator.next();
      if (result.done) {
        break;
      }
      if (result.value) {
        chunks.push(result.value as ChatMessage[]);
      }
    }

    expect(
      chunks.flatMap((group) => group).every((message) => !message.toolCalls),
    ).toBe(true);

    const text = chunks
      .flatMap((group) => group)
      .flatMap((message) => {
        if (typeof message.content === "string") {
          return [message.content];
        }
        if (Array.isArray(message.content)) {
          return message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text);
        }
        return [];
      })
      .join("");

    expect(text).toContain("TOOL_NAME: read_file");
    expect(text).toContain("BEGIN_ARG: path");
  });

  it("ignores content after a tool call", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: arg1\n" }],
      [{ role: "assistant", content: "value1\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
      [{ role: "assistant", content: "```\n" }],
      [{ role: "assistant", content: "This content should be ignored" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    let result;
    // Process through all the tool call parts
    for (let i = 0; i < 6; i++) {
      result = await generator.next();
    }

    // The content after the tool call should be ignored
    result = await generator.next();
    expect(result.value).toBeUndefined();
  });

  it("stops processing when aborted", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    // Process the first part
    let result = await generator.next();

    // Abort before processing the second part
    abortController.abort();

    // The next value should be undefined
    result = await generator.next();
    expect(result.value).toBeUndefined();
  });

  it("handles JSON parsing for argument values", async () => {
    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: number_arg\n" }],
      [{ role: "assistant", content: "123\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: boolean_arg\n" }],
      [{ role: "assistant", content: "true\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
      [{ role: "assistant", content: "```" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
      framework,
    );

    // Skip to number arg end
    await generator.next();
    await generator.next();
    let result;
    result = await generator.next();

    expect(
      (result?.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe("123");

    // Skip to boolean arg end
    await generator.next();
    result = await generator.next();

    expect(
      (result?.value as AssistantChatMessage[])[0].toolCalls?.[0].function
        ?.arguments,
    ).toBe("true");
  });
});
