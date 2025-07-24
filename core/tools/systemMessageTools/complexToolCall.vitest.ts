import { beforeEach, describe, expect, it } from "vitest";
import { AssistantChatMessage, ChatMessage, PromptLog } from "../..";
import { interceptSystemToolCalls } from "./interceptSystemToolCalls";

describe("interceptSystemToolCalls - Complex Tool Call Test", () => {
  let abortController: AbortController;

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

  function isAssistantMessageWithToolCalls(
    message: ChatMessage,
  ): message is AssistantChatMessage {
    return (
      message.role === "assistant" &&
      "toolCalls" in message &&
      message.toolCalls !== undefined &&
      message.toolCalls.length > 0
    );
  }

  async function collectAllResults(
    generator: AsyncGenerator<ChatMessage[], PromptLog | undefined>,
  ): Promise<ChatMessage[][]> {
    const results: ChatMessage[][] = [];
    while (true) {
      const result = await generator.next();
      if (result.done) break;
      if (result.value) results.push(result.value);
    }
    return results;
  }

  it("handles complex multi-line tool arguments with nested content and special characters", async () => {
    // This test case is based on the example.txt which has complex nested content
    // that includes JSON arrays, code blocks, escape characters, and the word "assistant"
    const complexDiffContent = `I'll add an exp method to the Calculator class in test.js. This method will raise the current result to the power of a given number.

\`\`\`tool
TOOL_NAME: search_and_replace_in_file
BEGIN_ARG: filepath
test.js
END_ARG
BEGIN_ARG: diff
[
"------- SEARCH
  /**
   * Divide the current result by a number
   * @param {number} number - The number to divide by
   * @
assistant
returns {Calculator} - Returns this instance for method chaining
   * @throws {Error} - Throws error if attempting to divide by zero
   */
  divide(number) {
    if (number === 0) {
      throw new Error(\"Cannot divide by zero\");
    }
    this.result /= number;
    return this;
  }

=======
  /**
   * Divide the current result by a number
   * @param {number} number - The number to
assistant
 divide by
   * @returns {Calculator} - Returns this instance for method chaining
   * @throws {Error} - Throws error if attempting to divide by zero
   */
  divide(number) {
    if (number === 0) {
      throw new Error(\"Cannot divide by zero\");
    }
    this.result /= number;
    return this;
  }

  /**
   * Raise the current result to the power of a number
   *
assistant
 @param {number} number - The exponent to raise to
   * @returns {Calculator} - Returns this instance for method chaining
   */
  exp(number) {
    this.result = Math.pow(this.result, number);
    return this;
  }

+++++++ REPLACE"
]
END_ARG
\`\`\``;

    const messages: ChatMessage[][] = [
      [
        {
          role: "assistant",
          content:
            "I'll add an exp method to the Calculator class in test.js.\n\n",
        },
      ],
      [{ role: "assistant", content: "```tool\n" }],
      [
        {
          role: "assistant",
          content: "TOOL_NAME: search_and_replace_in_file\n",
        },
      ],
      [{ role: "assistant", content: "BEGIN_ARG: filepath\n" }],
      [{ role: "assistant", content: "test.js\n" }],
      [{ role: "assistant", content: "END_ARG\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: diffs\n" }],
      [{ role: "assistant", content: complexDiffContent }],
      [{ role: "assistant", content: "\nEND_ARG\n" }],
      [{ role: "assistant", content: "```" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
    );

    const allResults = await collectAllResults(generator);

    // Should have processed intro text
    expect(allResults[0]).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'll add an exp method to the Calculator class in test.js.",
          },
        ],
      },
    ]);

    // Should have detected and parsed the tool call
    const toolCallResults = allResults.filter(
      (r): r is AssistantChatMessage[] =>
        r && r[0] && isAssistantMessageWithToolCalls(r[0]),
    );

    expect(toolCallResults.length).toBeGreaterThan(0);

    // Tool name should be correct
    const toolNameResult = toolCallResults.find(
      (r) =>
        r[0].toolCalls?.[0]?.function?.name === "search_and_replace_in_file",
    );
    expect(toolNameResult).toBeTruthy();

    // Reconstruct the full arguments from all deltas
    let fullArgs = "";
    for (const toolResult of toolCallResults) {
      fullArgs += toolResult[0].toolCalls?.[0]?.function?.arguments || "";
    }

    console.log("Full args reconstructed:", fullArgs);

    // Should be valid JSON
    expect(() => JSON.parse(fullArgs)).not.toThrow();

    const parsed = JSON.parse(fullArgs);
    expect(parsed.filepath).toBe("test.js");
    expect(parsed.diffs).toBeTruthy();

    // The diffs should contain the complex content including special markers
    const diffContent1 =
      typeof parsed.diffs === "string"
        ? parsed.diffs
        : JSON.stringify(parsed.diffs);
    expect(diffContent1).toContain("SEARCH");
    expect(diffContent1).toContain("REPLACE");
    expect(diffContent1).toContain("Cannot divide by zero");
    expect(diffContent1).toContain("assistant"); // Word should be preserved in content
  });

  it("handles arguments with embedded JSON and special escape sequences", async () => {
    // Test with JSON array containing embedded quotes and backslashes
    const jsonArrayContent = `["first item", "second \\"quoted\\" item", "third\\nitem"]`;

    const messages: ChatMessage[][] = [
      [{ role: "assistant", content: "```tool\n" }],
      [{ role: "assistant", content: "TOOL_NAME: test_tool\n" }],
      [{ role: "assistant", content: "BEGIN_ARG: json_array\n" }],
      [{ role: "assistant", content: jsonArrayContent }],
      [{ role: "assistant", content: "\nEND_ARG\n" }],
      [{ role: "assistant", content: "```" }],
    ];

    const generator = interceptSystemToolCalls(
      createAsyncGenerator(messages),
      abortController,
    );

    const allResults = await collectAllResults(generator);

    // Should have parsed the tool call
    const toolCallResults = allResults.filter(
      (r): r is AssistantChatMessage[] =>
        r && r[0] && isAssistantMessageWithToolCalls(r[0]),
    );

    expect(toolCallResults.length).toBeGreaterThan(0);

    // Reconstruct the full arguments
    let fullArgs = "";
    for (const toolResult of toolCallResults) {
      fullArgs += toolResult[0].toolCalls?.[0]?.function?.arguments || "";
    }

    // Should be valid JSON
    expect(() => JSON.parse(fullArgs)).not.toThrow();

    const parsed = JSON.parse(fullArgs);
    expect(parsed.json_array).toBeTruthy();

    // The parsed array should be correct
    const arrayValue =
      typeof parsed.json_array === "string"
        ? JSON.parse(parsed.json_array)
        : parsed.json_array;

    expect(Array.isArray(arrayValue)).toBe(true);
    expect(arrayValue).toHaveLength(3);
    expect(arrayValue[0]).toBe("first item");
    expect(arrayValue[1]).toBe('second "quoted" item');
    expect(arrayValue[2]).toBe("third\nitem");
  });

  it("simulates the exact user scenario that causes parsing issues", async () => {
    // This simulates the exact scenario from example.txt that was causing issues
    const userProblemDiff = `[
"------- SEARCH
  /**
   * Divide the current result by a number
   * @param {number} number - The number to divide by
   * @returns {Calculator} - Returns this instance for method chaining
   * @throws {Error} - Throws error if attempting to divide by zero
   */
  divide(number) {
    if (number === 0) {
      throw new Error(\"Cannot divide by zero\");
    }
    this.result /= number;
    return this;
  }
=======
  /**
   * Divide the current result by a number
   * @param {number} number - The number to divide by
   * @returns {Calculator} - Returns this instance for method chaining
   * @throws {Error} - Throws error if attempting to divide by zero
   */
  divide(number) {
    if (number === 0) {
      throw new Error(\"Cannot divide by zero\");
    }
    this.result /= number;
    return this;
  }

  /**
   * Raise the current result to the power of a number
   * @param {number} number - The exponent to raise to
   * @returns {Calculator} - Returns this instance for method chaining
   */
  exp(number) {
    this.result = Math.pow(this.result, number);
    return this;
  }
+++++++ REPLACE"
]`;

    // Test that the JSON string can be properly parsed and used
    let parsed;
    expect(() => {
      parsed = JSON.parse(userProblemDiff);
    }).not.toThrow();

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed!.length).toBe(1);

    const diffContent = parsed![0];
    expect(diffContent).toContain("------- SEARCH");
    expect(diffContent).toContain("=======");
    expect(diffContent).toContain("+++++++ REPLACE");
    expect(diffContent).toContain("Cannot divide by zero");
  });
});
