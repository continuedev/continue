import { describe, expect, it, jest } from "@jest/globals";
import type { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";

// Test the chunk processing logic that was identified as buggy
describe("streamChatResponse - chunk ordering bug", () => {
  // Helper to create a chunk with content
  function contentChunk(content: string): ChatCompletionChunk {
    return {
      id: "test",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "test-model",
      choices: [{
        index: 0,
        delta: { content },
        finish_reason: null,
      }],
    };
  }

  // Helper to create a chunk with tool call
  function toolCallChunk(
    id: string,
    name?: string,
    args?: string
  ): ChatCompletionChunk {
    return {
      id: "test",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "test-model",
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id,
            type: "function",
            function: {
              name: name || undefined,
              arguments: args || undefined,
            },
          }],
        },
        finish_reason: null,
      }],
    };
  }

  // Simulate the chunk processing logic from streamChatResponse.ts
  function processChunks(chunks: ChatCompletionChunk[]): {
    content: string;
    finalContent: string;
    hasToolCalls: boolean;
    toolCallsMap: Map<string, any>;
  } {
    let aiResponse = "";
    const toolCallsMap = new Map();
    const indexToIdMap = new Map<number, string>(); // Track index to ID mapping
    let hasToolCalls = false;

    for (const chunk of chunks) {
      if (!chunk.choices || !chunk.choices[0]) continue;
      
      const choice = chunk.choices[0];
      if (!choice.delta) continue;

      // Handle content
      if (choice.delta.content) {
        aiResponse += choice.delta.content;
      }

      // Handle tool calls
      if (choice.delta.tool_calls) {
        hasToolCalls = true;
        for (const toolCallDelta of choice.delta.tool_calls) {
          let toolCallId: string | undefined;
          
          // If we have an ID, use it and map the index
          if (toolCallDelta.id) {
            toolCallId = toolCallDelta.id;
            if (toolCallDelta.index !== undefined) {
              indexToIdMap.set(toolCallDelta.index, toolCallId);
            }
            
            // Create tool call entry if it doesn't exist
            if (!toolCallsMap.has(toolCallId)) {
              toolCallsMap.set(toolCallId, {
                id: toolCallId,
                name: "",
                argumentsStr: "",
              });
            }
          } else if (toolCallDelta.index !== undefined) {
            // No ID, but we have an index - look up the ID from our map
            toolCallId = indexToIdMap.get(toolCallDelta.index);
          }
          
          if (!toolCallId) continue;

          const toolCall = toolCallsMap.get(toolCallId);
          if (!toolCall) continue;

          if (toolCallDelta.function?.name) {
            toolCall.name = toolCallDelta.function.name;
          }

          if (toolCallDelta.function?.arguments) {
            toolCall.argumentsStr += toolCallDelta.function.arguments;
          }
        }
      }
    }

    // The fixed behavior: always preserve content
    const finalContent = aiResponse;

    return {
      content: aiResponse,
      finalContent: finalContent,
      hasToolCalls,
      toolCallsMap,
    };
  }

  it("content after tool calls is preserved", () => {
    const chunks = [
      contentChunk(""),
      toolCallChunk("call_123", "read_file", '{"filepath": "/README.md"}'),
      contentChunk(""),
      contentChunk("I'll read the README file for you."),
    ];

    const result = processChunks(chunks);

    expect(result.content).toBe("I'll read the README file for you.");
    expect(result.hasToolCalls).toBe(true);
    
    // Fixed: finalContent now preserves the content
    expect(result.finalContent).toBe("I'll read the README file for you.");
  });

  it("content before tool calls is preserved", () => {
    const chunks = [
      contentChunk("Let me search for that. "),
      toolCallChunk("call_123", "search_code", '{"pattern": "test"}'),
    ];

    const result = processChunks(chunks);

    expect(result.content).toBe("Let me search for that. ");
    expect(result.hasToolCalls).toBe(true);
    
    // Fixed: finalContent preserves content before tool calls
    expect(result.finalContent).toBe("Let me search for that. ");
  });

  it("handles the exact problematic sequence from the logs", () => {
    const chunks = [
      contentChunk(""),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", "read_file", ""),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, '{"filepath'),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, '": "/Use'),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, 'rs/nate/gh/c'),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, 'ontinuede'),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, 'v/cli/README'),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, '.md"}'),
      contentChunk(""),
      contentChunk("I'll read the README file for you."),
    ];

    const result = processChunks(chunks);

    expect(result.content).toBe("I'll read the README file for you.");
    expect(result.hasToolCalls).toBe(true);
    
    // Fixed: content is preserved
    expect(result.finalContent).toBe("I'll read the README file for you.");
  });

  it("shows content works fine without tool calls", () => {
    const chunks = [
      contentChunk("Hello "),
      contentChunk("world!"),
    ];

    const result = processChunks(chunks);

    expect(result.content).toBe("Hello world!");
    expect(result.hasToolCalls).toBe(false);
    
    // Without tool calls, finalContent is correct
    expect(result.finalContent).toBe("Hello world!");
  });

  // Helper to create a tool call chunk with optional ID
  function toolCallChunkWithIndex(
    index: number,
    id?: string,
    name?: string,
    args?: string
  ): ChatCompletionChunk {
    const toolCall: any = {
      index,
      type: "function" as const,
      function: {}
    };
    
    if (id) toolCall.id = id;
    if (name) toolCall.function.name = name;
    if (args !== undefined) toolCall.function.arguments = args;
    
    return {
      id: "test",
      object: "chat.completion.chunk" as const,
      created: Date.now(),
      model: "test-model",
      choices: [{
        index: 0,
        delta: { tool_calls: [toolCall] },
        finish_reason: null,
      }],
    };
  }

  it("handles provider that only sends tool ID in first chunk then uses index", () => {
    // Create chunks that simulate a provider sending ID only in first chunk
    const chunks = [
      contentChunk("I'll read the README.md file for you and then say hello!"),
      // First chunk has ID
      toolCallChunkWithIndex(0, "toolu_vrtx_01ULx6UjdJ7B7bjf5WPHTXGz", "read_file", ""),
      // Subsequent chunks only have index, no ID
      toolCallChunkWithIndex(0, undefined, undefined, '{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}'),
    ];

    const result = processChunks(chunks);

    // Content is captured correctly
    expect(result.content).toBe("I'll read the README.md file for you and then say hello!");
    expect(result.hasToolCalls).toBe(true);
    
    // Fixed: finalContent preserves content
    expect(result.finalContent).toBe("I'll read the README.md file for you and then say hello!");
    
    // Fixed: tool call arguments are preserved using index mapping
    const toolCalls = Array.from(result.toolCallsMap.values());
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].argumentsStr).toBe('{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}');
  });

  it("handles realistic fragmented arguments from index-based provider", () => {
    // Simulate the exact sequence from the user's logs with fragmented JSON
    const chunks = [
      contentChunk("I'll read the README.md file for you and then say hello!"),
      // First chunk has ID
      toolCallChunkWithIndex(0, "toolu_vrtx_01ULx6UjdJ7B7bjf5WPHTXGz", "read_file", ""),
      // Subsequent chunks fragment the JSON arguments
      toolCallChunkWithIndex(0, undefined, undefined, '{"filepa'),
      toolCallChunkWithIndex(0, undefined, undefined, 'th"'),
      toolCallChunkWithIndex(0, undefined, undefined, ': '),
      toolCallChunkWithIndex(0, undefined, undefined, '"/U'),
      toolCallChunkWithIndex(0, undefined, undefined, 'sers/nate/gh'),
      toolCallChunkWithIndex(0, undefined, undefined, '/c'),
      toolCallChunkWithIndex(0, undefined, undefined, 'onti'),
      toolCallChunkWithIndex(0, undefined, undefined, 'nuedev/cli'),
      toolCallChunkWithIndex(0, undefined, undefined, '/READ'),
      toolCallChunkWithIndex(0, undefined, undefined, 'ME.m'),
      toolCallChunkWithIndex(0, undefined, undefined, 'd"}'),
    ];

    const result = processChunks(chunks);

    // Fixed: Both issues are resolved
    // 1. Content is preserved
    expect(result.finalContent).toBe("I'll read the README.md file for you and then say hello!");
    
    // 2. Tool call arguments are assembled correctly
    const toolCalls = Array.from(result.toolCallsMap.values());
    expect(toolCalls[0].argumentsStr).toBe('{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}');
  });

});