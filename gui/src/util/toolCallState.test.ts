import { ToolCallDelta, ToolCallState } from "core";
import { addToolCallDeltaToState } from "./toolCallState";

describe("addToolCallDeltaToState", () => {
  it("should initialize a new tool call state when current state is undefined", () => {
    const delta: ToolCallDelta = {
      id: "call123",
      type: "function",
      function: {
        name: "searchFiles",
        arguments: '{"query":',
      },
    };

    const result = addToolCallDeltaToState(delta, undefined);

    expect(result).toEqual({
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":',
        },
      },
      toolCallId: "call123",
      parsedArgs: {
        query: undefined,
      },
    });
  });

  it("should merge function name deltas correctly", () => {
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "search",
          arguments: '{"query":',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: undefined },
    };

    const delta: ToolCallDelta = {
      function: {
        name: "Files",
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);

    expect(result.toolCall.function.name).toBe("searchFiles");
  });

  it("should handle name streaming in full progressive chunks", () => {
    // Test case where model streams the name progressively but includes full prefix each time
    // e.g. "readFi" -> "readFil" -> "readFile"
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "readFi",
          arguments: "{}",
        },
      },
      toolCallId: "call123",
      parsedArgs: {},
    };

    const delta: ToolCallDelta = {
      function: {
        name: "readFil",
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);
    expect(result.toolCall.function.name).toBe("readFil");

    // Continue the streaming
    const nextDelta: ToolCallDelta = {
      function: {
        name: "readFile",
      },
    };

    const finalResult = addToolCallDeltaToState(nextDelta, result);
    expect(finalResult.toolCall.function.name).toBe("readFile");
  });

  it("should keep original name when receiving duplicate name chunks", () => {
    // Test case where model streams the complete name multiple times
    // e.g. "readFile" -> "readFile" -> "readFile"
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "readFile",
          arguments: "{}",
        },
      },
      toolCallId: "call123",
      parsedArgs: {},
    };

    const delta: ToolCallDelta = {
      function: {
        name: "readFile",
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);
    expect(result.toolCall.function.name).toBe("readFile");
  });

  it("should handle partial name streaming", () => {
    // Test case where model streams the name in parts
    // e.g. "read" -> "File"
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "read",
          arguments: "{}",
        },
      },
      toolCallId: "call123",
      parsedArgs: {},
    };

    const delta: ToolCallDelta = {
      function: {
        name: "File",
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);
    expect(result.toolCall.function.name).toBe("readFile");
  });

  it("should ignore new tool calls with different IDs", () => {
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":"test"}',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: "test" },
    };

    const delta: ToolCallDelta = {
      id: "call456", // Different ID
      type: "function",
      function: {
        name: "readFile",
        arguments: '{"path":"file.txt"}',
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);

    // Should keep the original state and ignore the new call
    expect(result).toBe(currentState);
    expect(result.toolCall.id).toBe("call123");
    expect(result.toolCall.function.name).toBe("searchFiles");
  });

  it("should merge function argument deltas correctly", () => {
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":"java',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: "java" },
    };

    const delta: ToolCallDelta = {
      function: {
        arguments: 'script"}',
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);

    expect(result.toolCall.function.arguments).toBe('{"query":"javascript"}');
    expect(result.parsedArgs).toEqual({ query: "javascript" });
  });

  it("should handle empty deltas gracefully", () => {
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":"test"}',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: "test" },
    };

    const delta: ToolCallDelta = {};

    const result = addToolCallDeltaToState(delta, currentState);

    expect(result).toEqual(currentState);
  });

  it("should handle streaming complex JSON arguments", () => {
    const initialState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "editFile",
          arguments: '{"path":"',
        },
      },
      toolCallId: "call123",
      parsedArgs: { path: undefined },
    };

    // First chunk - add to path
    const delta1: ToolCallDelta = {
      function: {
        arguments: 'src/main.js","changes":{"',
      },
    };

    const state1 = addToolCallDeltaToState(delta1, initialState);
    expect(state1.toolCall.function.arguments).toBe(
      '{"path":"src/main.js","changes":{"',
    );

    // Second chunk - add property name
    const delta2: ToolCallDelta = {
      function: {
        arguments: 'content":"cons',
      },
    };

    const state2 = addToolCallDeltaToState(delta2, state1);
    expect(state2.toolCall.function.arguments).toBe(
      '{"path":"src/main.js","changes":{"content":"cons',
    );
    expect(state2.parsedArgs).toEqual({
      path: "src/main.js",
      changes: { content: "cons" },
    });

    // Third chunk - complete JSON
    const delta3: ToolCallDelta = {
      function: {
        arguments: 't message = \\"Hello\\";"}}',
      },
    };

    const state3 = addToolCallDeltaToState(delta3, state2);
    expect(state3.toolCall.function.arguments).toBe(
      '{"path":"src/main.js","changes":{"content":"const message = \\"Hello\\";"}}',
    );
    expect(state3.parsedArgs).toEqual({
      path: "src/main.js",
      changes: { content: 'const message = "Hello";' },
    });
  });

  it("should handle tool call ids correctly", () => {
    // Test when ID comes from current state
    let currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "existing-id",
        type: "function",
        function: {
          name: "test",
          arguments: "{}",
        },
      },
      toolCallId: "existing-id",
      parsedArgs: {},
    };

    let delta: ToolCallDelta = {
      // No id in delta
      function: {
        name: "Function",
      },
    };

    let result = addToolCallDeltaToState(delta, currentState);
    expect(result.toolCallId).toBe("existing-id");

    // Test when ID comes from delta
    delta = {
      id: "new-id",
      function: {
        name: "test",
      },
    };

    result = addToolCallDeltaToState(delta, undefined);
    expect(result.toolCallId).toBe("new-id");
  });

  it("should handle invalid JSON gracefully", () => {
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: undefined },
    };

    const delta: ToolCallDelta = {
      function: {
        arguments: '"test"',
      },
    };

    const result = addToolCallDeltaToState(delta, currentState);

    expect(result.toolCall.function.arguments).toBe('{"query":"test"');
    // Expect partial parsing still works
    expect(result.parsedArgs).toEqual({ query: "test" });
  });

  it("should handle realistic weather API streaming pattern from OpenAI example", () => {
    // https://platform.openai.com/docs/guides/function-calling?api-mode=chat#streaming
    // Sequence of deltas as seen in the streaming example
    const streamSequence: ToolCallDelta[] = [
      {
        id: "call_DdmO9pD3xa9XTPNJ32zg2hcA",
        type: "function",
        function: {
          name: "get_weather",
          arguments: "",
        },
      },
      {
        function: {
          arguments: '{"',
        },
      },
      {
        function: {
          arguments: "location",
        },
      },
      {
        function: {
          arguments: '":"',
        },
      },
      {
        function: {
          arguments: "Paris",
        },
      },
      {
        function: {
          arguments: ",",
        },
      },
      {
        function: {
          arguments: " France",
        },
      },
      {
        function: {
          arguments: '"}',
        },
      },
    ];

    // Initialize with undefined state
    let currentState: ToolCallState | undefined = undefined;

    // Process each delta in sequence
    for (const delta of streamSequence) {
      currentState = addToolCallDeltaToState(delta, currentState);
    }

    // Check the final state
    expect(currentState).toEqual({
      status: "generating",
      toolCall: {
        id: "call_DdmO9pD3xa9XTPNJ32zg2hcA",
        type: "function",
        function: {
          name: "get_weather",
          arguments: '{"location":"Paris, France"}',
        },
      },
      toolCallId: "call_DdmO9pD3xa9XTPNJ32zg2hcA",
      parsedArgs: {
        location: "Paris, France",
      },
    });

    // Check the intermediate state after each delta to ensure incremental parsing works
    currentState = undefined;

    // First delta - initialize
    currentState = addToolCallDeltaToState(streamSequence[0], currentState);
    expect(currentState.toolCall.function.name).toBe("get_weather");
    expect(currentState.toolCall.function.arguments).toBe("");
    expect(currentState.parsedArgs).toEqual({});

    // Second delta - start JSON
    currentState = addToolCallDeltaToState(streamSequence[1], currentState);
    expect(currentState.toolCall.function.arguments).toBe('{"');
    expect(currentState.parsedArgs).toEqual({});

    // Third delta - add key name
    currentState = addToolCallDeltaToState(streamSequence[2], currentState);
    expect(currentState.toolCall.function.arguments).toBe('{"location');
    expect(currentState.parsedArgs).toEqual({ location: undefined });

    // Fourth delta - add key-value separator
    currentState = addToolCallDeltaToState(streamSequence[3], currentState);
    expect(currentState.toolCall.function.arguments).toBe('{"location":"');
    expect(currentState.parsedArgs).toEqual({ location: "" });

    // Fifth delta - add first part of value
    currentState = addToolCallDeltaToState(streamSequence[4], currentState);
    expect(currentState.toolCall.function.arguments).toBe('{"location":"Paris');
    expect(currentState.parsedArgs).toEqual({ location: "Paris" });

    // Sixth delta - add comma
    currentState = addToolCallDeltaToState(streamSequence[5], currentState);
    expect(currentState.toolCall.function.arguments).toBe(
      '{"location":"Paris,',
    );
    expect(currentState.parsedArgs).toEqual({ location: "Paris," });

    // Seventh delta - add rest of value
    currentState = addToolCallDeltaToState(streamSequence[6], currentState);
    expect(currentState.toolCall.function.arguments).toBe(
      '{"location":"Paris, France',
    );
    expect(currentState.parsedArgs).toEqual({ location: "Paris, France" });

    // Eighth delta - close JSON
    currentState = addToolCallDeltaToState(streamSequence[7], currentState);
    expect(currentState.toolCall.function.arguments).toBe(
      '{"location":"Paris, France"}',
    );
    expect(currentState.parsedArgs).toEqual({ location: "Paris, France" });
  });

  it("should handle when args are complete JSON and new deltas arrive", () => {
    // When args are already a valid JSON object, new deltas should not modify it
    const currentState: ToolCallState = {
      status: "generating",
      toolCall: {
        id: "call123",
        type: "function",
        function: {
          name: "searchFiles",
          arguments: '{"query":"test","limit":10}',
        },
      },
      toolCallId: "call123",
      parsedArgs: { query: "test", limit: 10 },
    };

    const delta: ToolCallDelta = {
      function: {
        arguments: ',"sort":"asc"}',
      },
    };

    // The complete JSON should not be modified
    const result = addToolCallDeltaToState(delta, currentState);
    expect(result.toolCall.function.arguments).toBe(
      '{"query":"test","limit":10}',
    );
    expect(result.parsedArgs).toEqual({ query: "test", limit: 10 });
  });
});
