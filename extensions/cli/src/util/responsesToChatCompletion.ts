import {
  BaseLlmApi,
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionCreateParamsStreaming,
  Response,
  ResponseCreateParamsStreaming,
} from "@continuedev/openai-adapters";
import { ChatCompletionContentPartRefusal } from "openai/resources";
import {
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseOutputItem,
} from "openai/resources/responses/responses.mjs";

function chatCompletionContentPartsToString(
  parts:
    | string
    | (ChatCompletionContentPart | ChatCompletionContentPartRefusal)[]
    | undefined
    | null,
): string {
  if (!parts) {
    return "";
  }
  if (typeof parts === "string") {
    return parts;
  }
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function _responseToChatCompletionChunk(chunk: Response): ChatCompletionChunk {
  const textOutput = chunk.output_text;
  const toolCalls: ChatCompletionChunk.Choice.Delta.ToolCall[] = chunk.output
    ?.filter((item) => item.type === "function_call")
    .map((item, index) => ({
      index,
      function: {
        name: item.name,
        arguments: item.arguments,
      },
      id: item.id,
      type: "function" as const,
    }));

  return {
    id: chunk.id,
    object: "chat.completion.chunk",
    created: chunk.created_at,
    model: chunk.model,
    service_tier: chunk.service_tier,
    usage: {
      prompt_tokens: chunk.usage?.input_tokens ?? 0,
      completion_tokens: chunk.usage?.output_tokens ?? 0,
      total_tokens: chunk.usage?.total_tokens ?? 0,
      completion_tokens_details: chunk.usage?.output_tokens_details,
      prompt_tokens_details: chunk.usage?.input_tokens_details,
    },
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: null,
        delta: {
          content: textOutput,
          role: "assistant",
          tool_calls: toolCalls,
        },
      },
    ],
  };
}

function chatCompletionBodyToResponseBody(
  body: ChatCompletionCreateParamsStreaming,
): ResponseCreateParamsStreaming {
  const input: ResponseInput = [];

  body.messages.forEach((msg) => {
    if (msg.role === "user") {
      input.push({
        role: "user",
        content: chatCompletionContentPartsToString(msg.content),
      });
    } else if (msg.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: msg.tool_call_id,
        output: chatCompletionContentPartsToString(msg.content),
      });
    } else if (msg.role === "assistant") {
      input.push({
        role: "assistant",
        content: chatCompletionContentPartsToString(msg.content),
      });
      msg.tool_calls?.forEach((toolCall) => {
        if (toolCall.type !== "function") {
          return;
        }
        const inputItem: ResponseFunctionToolCall = {
          id: toolCall.id,
          type: "function_call",
          arguments: toolCall.function.arguments,
          call_id: toolCall.id,
          name: toolCall.function.name,
        };
        input.push(inputItem);
      });
    }
  });

  const instructions = chatCompletionContentPartsToString(
    body.messages.find((message) => message.role === "system")?.content,
  );

  const responsesBody: ResponseCreateParamsStreaming = {
    stream: true,
    tool_choice: undefined,
    tools: body.tools
      ?.filter((tool) => tool.type === "function")
      .map((tool) => ({
        name: tool.function.name,
        type: "function" as const,
        parameters: tool.function.parameters ?? null,
        description: tool.function.description,
        strict: tool.function.strict ?? null,
      })),
    store: false,
    previous_response_id: null,
    input,
    instructions,
    max_output_tokens: body.max_completion_tokens,
    model: body.model,
    top_p: body.top_p,
    temperature: body.temperature,
    parallel_tool_calls: body.parallel_tool_calls,
    reasoning: { effort: body.reasoning_effort, summary: "auto" },
    safety_identifier: body.safety_identifier,
    background: false,
    include: null,
    service_tier: body.service_tier,
    stream_options: body.stream_options,
    prompt_cache_key: body.prompt_cache_key,
    metadata: body.metadata,
  };

  return responsesBody;
}

export async function* responsesToChatCompletion(
  params: ChatCompletionCreateParamsStreaming,
  abortSignal: AbortSignal,
  llmApi: BaseLlmApi,
): AsyncGenerator<ChatCompletionChunk> {
  if (!llmApi.responsesStream) {
    throw new Error("LLM API does not support responses stream");
  }

  const generator = llmApi.responsesStream(
    chatCompletionBodyToResponseBody(params),
    abortSignal,
  );

  let responseId: string;
  const outputItems: ResponseOutputItem[] = [];

  // This is a lazy way to handle the response that works because we don't care about streaming deltas
  for await (const chunk of generator) {
    switch (chunk.type) {
      case "response.created":
        responseId = chunk.response.id;
        break;
      case "response.output_item.done":
        outputItems.push(chunk.item);
        break;
      default:
        break;
    }
  }

  const reasoningItem = outputItems.find((item) => item.type === "reasoning");
  if (reasoningItem) {
    // TODO
  }

  const chunk: ChatCompletionChunk = {
    id: responseId!,
    created: Date.now(),
    model: params.model,
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        finish_reason: null,
        delta: {
          role: "assistant",
          content: outputItems
            .filter((item) => item.type === "message")
            .map((item) =>
              item.content
                .filter((part) => part.type === "output_text")
                .map((part) => part.text)
                .join(""),
            )
            .join(""),
          tool_calls: outputItems
            .filter((item) => item.type === "function_call")
            .map((item, index) => ({
              index,
              id: item.id,
              type: "function" as const,
              function: {
                name: item.name,
                arguments: item.arguments,
              },
            })),
        },
      },
    ],
  };

  // for (const item of outputItems) {
  //   console.log(item);
  // }

  yield chunk;
}
