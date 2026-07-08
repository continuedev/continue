import { describe, expect, it } from "vitest";

import type { ChatCompletionChunk } from "openai/resources/index.js";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
} from "openai/resources/index.js";
import type {
  Response,
  ResponseCompletedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseFunctionCallArgumentsDoneEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseReasoningTextDeltaEvent,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses.js";

import {
  createResponsesStreamState,
  fromResponsesChunk,
  responseToChatCompletion,
  toResponsesInput,
} from "../apis/openaiResponses.js";

describe("toResponsesInput", () => {
  it("maps assistant text content to output_text with generated msg ids", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: "Hello there!",
      },
    ];

    const inputItems = toResponsesInput(messages);

    expect(inputItems).toHaveLength(1);
    const assistant = inputItems[0] as any;
    expect(assistant).toMatchObject({
      type: "message",
      role: "assistant",
      id: "msg_0000",
    });
    expect(assistant.content).toMatchObject([
      {
        type: "output_text",
        text: "Hello there!",
      },
    ]);
  });

  it("maps assistant refusal content to refusal output items", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: "",
        refusal: "I must decline.",
      } as ChatCompletionAssistantMessageParam,
    ];

    const inputItems = toResponsesInput(messages);

    expect(inputItems).toHaveLength(1);
    const assistant = inputItems[0] as any;
    expect(assistant.content).toEqual([
      {
        type: "refusal",
        refusal: "I must decline.",
      },
    ]);
  });

  it("converts assistant structured content into output_text items", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Structured hello." }],
      } as ChatCompletionAssistantMessageParam,
    ];

    const inputItems = toResponsesInput(messages);

    const assistant = inputItems[0] as any;
    expect(assistant.content).toMatchObject([
      {
        type: "output_text",
        text: "Structured hello.",
      },
    ]);
  });

  it("converts chat messages, multimodal content, and tool interactions into Responses input items", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "Stay concise." },
      {
        role: "user",
        content: [
          { type: "text", text: "Look at this image" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png", detail: "auto" },
          },
        ],
      },
      {
        role: "assistant",
        tool_calls: [
          {
            id: "fc_call_1",
            type: "function",
            function: {
              name: "searchDocs",
              arguments: '{"query":"vitest expectations"}',
            },
          },
        ],
        content: "",
      } as ChatCompletionAssistantMessageParam,
      {
        role: "tool",
        tool_call_id: "call_1",
        content: "Found 3 relevant documents.",
      },
    ];

    const inputItems = toResponsesInput(messages);

    expect(inputItems).toMatchObject([
      {
        type: "message",
        role: "developer",
        content: [{ type: "input_text", text: "Stay concise." }],
      },
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Look at this image" },
          {
            type: "input_image",
            image_url: "https://example.com/cat.png",
            detail: "auto",
          },
        ],
      },
      {
        type: "function_call",
        call_id: "fc_call_1",
        id: "fc_call_1",
        name: "searchDocs",
        arguments: '{"query":"vitest expectations"}',
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output: "Found 3 relevant documents.",
      },
    ]);
  });
});

it("omits function_call id when tool call id lacks fc_ prefix", () => {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "assistant",
      tool_calls: [
        {
          id: "call_custom",
          type: "function",
          function: {
            name: "lookup",
            arguments: "{}",
          },
        },
      ],
      content: "",
    } as ChatCompletionAssistantMessageParam,
  ];

  const inputItems = toResponsesInput(messages);
  const functionCall = inputItems.find(
    (item: any) => item.type === "function_call",
  ) as any;

  expect(functionCall).toBeTruthy();
  expect(functionCall.call_id).toBe("call_custom");
  expect(functionCall).not.toHaveProperty("id");
});

describe("fromResponsesChunk", () => {
  function collectChunks(events: ResponseStreamEvent[]): ChatCompletionChunk[] {
    const state = createResponsesStreamState({
      created: 1710000000,
      model: "gpt-5-preview",
      responseId: "resp_123",
    });

    const chunks: ChatCompletionChunk[] = [];
    for (const event of events) {
      const result = fromResponsesChunk(state, event);
      if (result) {
        chunks.push(result);
      }
    }
    return chunks;
  }

  it("emits incremental assistant content and finish_reason from Responses text deltas", () => {
    const messageAdded: ResponseOutputItemAddedEvent = {
      type: "response.output_item.added",
      output_index: 0,
      sequence_number: 1,
      item: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        content: [],
      } as any,
    };
    const firstDelta: ResponseTextDeltaEvent = {
      type: "response.output_text.delta",
      sequence_number: 2,
      item_id: "msg_1",
      output_index: 0,
      content_index: 0,
      delta: "Hello",
      logprobs: [],
    };
    const secondDelta: ResponseTextDeltaEvent = {
      type: "response.output_text.delta",
      sequence_number: 3,
      item_id: "msg_1",
      output_index: 0,
      content_index: 0,
      delta: " world",
      logprobs: [],
    };
    const messageDone: ResponseOutputItemDoneEvent = {
      type: "response.output_item.done",
      sequence_number: 4,
      output_index: 0,
      item: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "Hello world",
          },
        ],
      } as any,
    };
    const completed: ResponseCompletedEvent = {
      type: "response.completed",
      sequence_number: 5,
      response: {
        id: "resp_123",
        object: "response",
        model: "gpt-5-preview",
        created_at: 1710000000,
        output_text: "Hello world",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        output: [],
        parallel_tool_calls: false,
        temperature: null,
        tool_choice: null as any,
        tools: [],
        usage: {
          input_tokens: 12,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 9,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 21,
        },
      } as unknown as Response,
    };

    const chunks = collectChunks([
      messageAdded,
      firstDelta,
      secondDelta,
      messageDone,
      completed,
    ]);

    expect(chunks[0].choices[0].delta.content).toBe("Hello");
    expect(chunks[1].choices[0].delta.content).toBe(" world");
    const finishChunk = chunks.find(
      (chunk) => chunk.choices[0].finish_reason !== null,
    );
    expect(finishChunk?.choices[0].finish_reason).toBe("stop");
    const usageChunk = chunks[chunks.length - 1];
    expect(usageChunk.usage).toMatchObject({
      prompt_tokens: 12,
      completion_tokens: 9,
      total_tokens: 21,
    });
  });

  it("tracks streaming tool call arguments and surfaces tool_calls deltas", () => {
    const toolAdded: ResponseOutputItemAddedEvent = {
      type: "response.output_item.added",
      sequence_number: 1,
      output_index: 0,
      item: {
        id: "tool_item_1",
        type: "function_call",
        call_id: "call_99",
        name: "searchDocs",
        arguments: "",
        status: "in_progress",
      } as any,
    };
    const toolDeltaA: ResponseFunctionCallArgumentsDeltaEvent = {
      type: "response.function_call_arguments.delta",
      sequence_number: 2,
      item_id: "tool_item_1",
      output_index: 0,
      delta: '{"query":"vit',
    };
    const toolDeltaB: ResponseFunctionCallArgumentsDeltaEvent = {
      type: "response.function_call_arguments.delta",
      sequence_number: 3,
      item_id: "tool_item_1",
      output_index: 0,
      delta: 'est"}',
    };
    const toolDone: ResponseFunctionCallArgumentsDoneEvent = {
      type: "response.function_call_arguments.done",
      sequence_number: 4,
      item_id: "tool_item_1",
      output_index: 0,
      arguments: '{"query":"vitest"}',
    };
    const toolOutputDone: ResponseOutputItemDoneEvent = {
      type: "response.output_item.done",
      sequence_number: 5,
      output_index: 0,
      item: {
        id: "tool_item_1",
        type: "function_call",
        call_id: "call_99",
        name: "searchDocs",
        arguments: '{"query":"vitest"}',
        status: "completed",
      } as any,
    };

    const chunks = collectChunks([
      toolAdded,
      toolDeltaA,
      toolDeltaB,
      toolDone,
      toolOutputDone,
    ]);

    expect(chunks[0].choices[0].delta.tool_calls?.[0].function?.arguments).toBe(
      '{"query":"vit',
    );
    expect(chunks[1].choices[0].delta.tool_calls?.[0].function?.arguments).toBe(
      'est"}',
    );
    const toolFinish = chunks[chunks.length - 1];
    expect(toolFinish.choices[0].finish_reason).toBe("tool_calls");
  });

  it("emits reasoning deltas when reasoning items stream", () => {
    const reasoningAdded: ResponseOutputItemAddedEvent = {
      type: "response.output_item.added",
      sequence_number: 1,
      output_index: 0,
      item: {
        id: "reason_1",
        type: "reasoning",
        summary: [],
        content: [],
      } as any,
    };
    const reasoningDelta: ResponseReasoningTextDeltaEvent = {
      type: "response.reasoning_text.delta",
      sequence_number: 2,
      item_id: "reason_1",
      output_index: 0,
      content_index: 0,
      delta: "First, inspect the repository structure.",
    };

    const chunks = collectChunks([reasoningAdded, reasoningDelta]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta).toMatchObject({
      reasoning: {
        content: [
          {
            type: "reasoning_text",
            text: "First, inspect the repository structure.",
          },
        ],
      },
    });
  });
});

describe("responseToChatCompletion", () => {
  it("converts a completed Responses payload into a ChatCompletion summary", () => {
    const response = {
      id: "resp_final",
      object: "response",
      model: "gpt-5-mini",
      created_at: 1710000001,
      output_text: "Tool call required.",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      parallel_tool_calls: false,
      temperature: null,
      tool_choice: null,
      tools: [],
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 4 },
        output_tokens: 42,
        output_tokens_details: { reasoning_tokens: 10 },
        total_tokens: 142,
      },
      output: [
        {
          id: "reason_final",
          type: "reasoning",
          summary: [],
          content: [
            {
              type: "reasoning_text",
              text: "Identify missing unit tests first.",
            },
          ],
        },
        {
          id: "tool_item_final",
          type: "function_call",
          call_id: "call_final",
          name: "searchDocs",
          arguments: '{"query":"unit tests"}',
          status: "completed",
        },
        {
          id: "msg_final",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "Triggering searchDocs tool with the provided query.",
            },
          ],
        },
      ],
    } as unknown as Response;

    const result = responseToChatCompletion(response);

    expect(result.choices[0].message.content).toBe(
      "Triggering searchDocs tool with the provided query.",
    );
    expect(result.choices[0].message.tool_calls).toEqual([
      {
        id: "call_final",
        type: "function",
        function: {
          name: "searchDocs",
          arguments: '{"query":"unit tests"}',
        },
      },
    ]);
    expect(result.choices[0].finish_reason).toBe("tool_calls");
    expect(result.usage).toEqual({
      prompt_tokens: 100,
      completion_tokens: 42,
      total_tokens: 142,
    });
  });
});
