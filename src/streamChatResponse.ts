import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources.mjs";

import { filterExcludedTools } from "./permissions/index.js";
import {
  getServiceSync,
  MCPServiceState,
  MCPTool,
  SERVICE_NAMES,
} from "./services/index.js";
import type { ToolPermissionServiceState } from "./services/ToolPermissionService.js";
import {
  processChunkContent,
  processToolCallDelta,
  recordStreamTelemetry,
  preprocessStreamedToolCalls,
  executeStreamedToolCalls,
  trackFirstTokenTime,
} from "./streamChatResponse.helpers.js";
import {
  StreamCallbacks,
  getDefaultCompletionOptions,
} from "./streamChatResponse.types.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { getAllBuiltinTools, ToolCall } from "./tools/index.js";
import {
  chatCompletionStreamWithBackoff,
  withExponentialBackoff,
} from "./util/exponentialBackoff.js";
import { logger } from "./util/logger.js";

dotenv.config();

function updateFinalResponse(
  content: string,
  shouldContinue: boolean,
  isHeadless: boolean,
  currentFinalResponse: string,
): string {
  if (!shouldContinue) {
    return content;
  } else if (isHeadless && content) {
    return content;
  }
  return currentFinalResponse;
}

function handleContentDisplay(
  content: string,
  callbacks: StreamCallbacks | undefined,
  isHeadless: boolean,
): void {
  // Add newline after content if needed
  if (!callbacks?.onContent && !isHeadless && content) {
    logger.info("");
  }

  // Notify content complete
  if (content && callbacks?.onContentComplete) {
    callbacks.onContentComplete(content);
  }
}

async function handleToolCalls(
  toolCalls: ToolCall[],
  chatHistory: ChatCompletionMessageParam[],
  content: string,
  callbacks: StreamCallbacks | undefined,
  isHeadless: boolean,
): Promise<boolean> {
  if (toolCalls.length === 0) {
    if (content) {
      chatHistory.push({ role: "assistant", content });
    }
    return false;
  }

  const toolCallsForHistory: ChatCompletionMessageToolCall[] = toolCalls.map(
    (tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }),
  );

  chatHistory.push({
    role: "assistant",
    content: content || null,
    tool_calls: toolCallsForHistory,
  });

  // First preprocess the tool calls
  const { preprocessedCalls, errorChatEntries } =
    await preprocessStreamedToolCalls(toolCalls, callbacks);

  // Add any preprocessing errors to chat history
  chatHistory.push(...errorChatEntries);

  // Execute the valid preprocessed tool calls
  const { chatHistoryEntries: toolResults, hasRejection } =
    await executeStreamedToolCalls(preprocessedCalls, callbacks, isHeadless);

  if (isHeadless && hasRejection) {
    logger.debug(
      "Tool call rejected in headless mode - returning current content",
    );
    return true; // Signal early return needed
  }

  chatHistory.push(...toolResults);
  return false;
}

export async function getAllTools() {
  // Get all available tool names
  const allBuiltinTools = getAllBuiltinTools();
  const builtinToolNames = allBuiltinTools.map((tool) => tool.name);

  let mcpTools: MCPTool[] = [];
  let mcpToolNames: string[] = [];
  const mcpServiceResult = getServiceSync<MCPServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
  );
  if (mcpServiceResult.state === "ready") {
    mcpTools = mcpServiceResult?.value?.tools ?? [];
    mcpToolNames = mcpTools.map((t) => t.name);
  } else {
    // MCP is lazy
    // throw new Error("MCP Service not initialized");
  }

  const allToolNames = [...builtinToolNames, ...mcpToolNames];

  // Check if the ToolPermissionService is ready
  const permissionsServiceResult = getServiceSync<ToolPermissionServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
  );

  let allowedToolNames: string[];
  if (
    permissionsServiceResult.state === "ready" &&
    permissionsServiceResult.value
  ) {
    // Filter out excluded tools based on permissions
    allowedToolNames = filterExcludedTools(
      allToolNames,
      permissionsServiceResult.value.permissions,
    );
  } else {
    // Service not ready - this is a critical error since tools should only be
    // requested after services are properly initialized
    logger.error(
      "ToolPermissionService not ready in getAllTools - this indicates a service initialization timing issue",
    );
    throw new Error(
      "ToolPermissionService not initialized. Services must be initialized before requesting tools.",
    );
  }

  const allowedToolNamesSet = new Set(allowedToolNames);

  // Filter builtin tools
  const allowedBuiltinTools = allBuiltinTools.filter((tool) =>
    allowedToolNamesSet.has(tool.name),
  );

  const allTools: ChatCompletionTool[] = allowedBuiltinTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              items: param.items,
            },
          ]),
        ),
        required: Object.entries(tool.parameters)
          .filter(([_, param]) => param.required)
          .map(([key, _]) => key),
      },
    },
  }));

  // Add filtered MCP tools
  const allowedMcpTools = mcpTools.filter((tool) =>
    allowedToolNamesSet.has(tool.name),
  );

  allTools.push(
    ...allowedMcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    })),
  );

  return allTools;
}

// Helper function to process a single chunk
interface ProcessChunkOptions {
  chunk: any;
  aiResponse: string;
  toolCallsMap: Map<string, ToolCall>;
  indexToIdMap: Map<number, string>;
  callbacks?: StreamCallbacks;
  isHeadless?: boolean;
}

function processChunk(options: ProcessChunkOptions): {
  aiResponse: string;
  shouldContinue: boolean;
} {
  const {
    chunk,
    aiResponse,
    toolCallsMap,
    indexToIdMap,
    callbacks,
    isHeadless,
  } = options;
  // Safety check: ensure chunk has the expected structure
  if (!chunk.choices || !chunk.choices[0]) {
    logger.warn("Malformed chunk received - missing choices", { chunk });
    return { aiResponse, shouldContinue: true };
  }

  const choice = chunk.choices[0];
  if (!choice.delta) {
    logger.warn("Malformed chunk received - missing delta", { chunk });
    return { aiResponse, shouldContinue: true };
  }

  let updatedResponse = aiResponse;

  // Handle content streaming
  if (choice.delta.content) {
    updatedResponse = processChunkContent(
      choice.delta.content,
      aiResponse,
      callbacks,
      isHeadless,
    );
  }

  // Handle tool calls
  if (choice.delta.tool_calls) {
    for (const toolCallDelta of choice.delta.tool_calls) {
      processToolCallDelta(toolCallDelta, toolCallsMap, indexToIdMap);
    }
  }

  return { aiResponse: updatedResponse, shouldContinue: true };
}

interface ProcessStreamingResponseOptions {
  chatHistory: ChatCompletionMessageParam[];
  model: ModelConfig;
  llmApi: BaseLlmApi;
  abortController: AbortController;
  callbacks?: StreamCallbacks;
  isHeadless?: boolean;
  tools?: ChatCompletionTool[];
}

// Process a single streaming response and return whether we need to continue
export async function processStreamingResponse(
  options: ProcessStreamingResponseOptions,
): Promise<{
  content: string;
  finalContent: string; // Added field for final content only
  toolCalls: ToolCall[];
  shouldContinue: boolean;
}> {
  const {
    chatHistory,
    model,
    llmApi,
    abortController,
    callbacks,
    isHeadless,
    tools,
  } = options;
  const requestStartTime = Date.now();

  const streamFactory = async () => {
    logger.debug("Creating chat completion stream", {
      model,
      messageCount: chatHistory.length,
      toolCount: tools?.length || 0,
    });
    return await chatCompletionStreamWithBackoff(
      llmApi,
      {
        model: model.model,
        messages: chatHistory,
        stream: true,
        tools,
        ...getDefaultCompletionOptions(model.defaultCompletionOptions),
      },
      abortController.signal,
    );
  };

  let aiResponse = "";
  let finalContent = "";
  const toolCallsMap = new Map<string, ToolCall>();
  const indexToIdMap = new Map<number, string>(); // Track index to ID mapping
  let firstTokenTime: number | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal,
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      // Track token usage if available
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
      }

      // Check if we should abort
      if (abortController?.signal.aborted) {
        logger.debug("Stream aborted");
        break;
      }

      // Track first token time
      firstTokenTime = trackFirstTokenTime(
        firstTokenTime,
        chunk,
        requestStartTime,
        model,
        tools,
      );

      const result = processChunk({
        chunk,
        aiResponse,
        toolCallsMap,
        indexToIdMap,
        callbacks,
        isHeadless,
      });
      aiResponse = result.aiResponse;
      if (!result.shouldContinue) break;
    }

    const responseEndTime = Date.now();
    const cost = recordStreamTelemetry({
      requestStartTime,
      responseEndTime,
      inputTokens,
      outputTokens,
      model,
      tools,
    });
    const totalDuration = responseEndTime - requestStartTime;

    logger.debug("Stream complete", {
      chunkCount,
      responseLength: aiResponse.length,
      toolCallsCount: toolCallsMap.size,
      inputTokens,
      outputTokens,
      cost,
      duration: totalDuration,
    });
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;

    // Log failed API request
    telemetryService.logApiRequest({
      model: model.model,
      durationMs: errorDuration,
      success: false,
      error: error.message || String(error),
    });

    if (error.name === "AbortError" || abortController?.signal.aborted) {
      logger.debug("Stream aborted by user");
      return {
        content: aiResponse,
        finalContent: aiResponse,
        toolCalls: [],
        shouldContinue: false,
      };
    }
    throw error;
  }

  const toolCalls = Array.from(toolCallsMap.values());

  // Validate tool calls have complete arguments
  const validToolCalls = toolCalls.filter((tc) => {
    if (!tc.arguments || !tc.name) {
      logger.error("Incomplete tool call", {
        id: tc.id,
        name: tc.name,
        hasArguments: !!tc.arguments,
        argumentsStr: tc.argumentsStr,
      });
      return false;
    }
    return true;
  });

  // Always preserve the content - it should be displayed regardless of tool calls
  finalContent = aiResponse;

  return {
    content: aiResponse,
    finalContent: finalContent,
    toolCalls: validToolCalls,
    shouldContinue: validToolCalls.length > 0,
  };
}

// Main function that handles the conversation loop
export async function streamChatResponse(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks,
) {
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const serviceResult = getServiceSync<ToolPermissionServiceState>(
    SERVICE_NAMES.TOOL_PERMISSIONS,
  );
  const isHeadless = serviceResult.value?.isHeadless ?? false;
  const tools = await getAllTools();

  logger.debug("Tools prepared", {
    toolCount: tools.length,
    toolNames: tools.map((t) => t.function.name),
  });

  let fullResponse = "";
  let finalResponse = "";

  while (true) {
    logger.debug("Starting conversation iteration");

    // Get response from LLM
    const { content, toolCalls, shouldContinue } =
      await processStreamingResponse({
        chatHistory,
        model,
        llmApi,
        abortController,
        callbacks,
        isHeadless,
        tools,
      });

    fullResponse += content;

    // Update final response based on mode
    finalResponse = updateFinalResponse(
      content,
      shouldContinue,
      isHeadless,
      finalResponse,
    );

    // Handle content display
    handleContentDisplay(content, callbacks, isHeadless);

    // Handle tool calls and check for early return
    const shouldReturn = await handleToolCalls(
      toolCalls,
      chatHistory,
      content,
      callbacks,
      isHeadless,
    );

    if (shouldReturn) {
      return finalResponse || content || fullResponse;
    }

    // Check if we should continue
    if (!shouldContinue) {
      break;
    }
  }

  logger.debug("streamChatResponse complete", {
    totalResponseLength: fullResponse.length,
    totalMessages: chatHistory.length,
  });

  // For headless mode, we return only the final response
  // Otherwise, return the full response
  return isHeadless ? finalResponse : fullResponse;
}
