import { CompletionOptions, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources.mjs";
import { parseArgs } from "./args.js";
import { MCPService } from "./mcp.js";
import {
  checkToolPermission,
  filterExcludedTools,
} from "./permissions/index.js";
import { toolPermissionManager } from "./permissions/permissionManager.js";
import telemetryService from "./telemetry/telemetryService.js";
import { calculateTokenCost } from "./telemetry/utils.js";
import { executeToolCall } from "./tools.js";
import { BUILTIN_TOOLS } from "./tools/index.js";
import {
  chatCompletionStreamWithBackoff,
  withExponentialBackoff,
} from "./util/exponentialBackoff.js";
import logger from "./util/logger.js";

dotenv.config();

export function getAllTools() {
  const args = parseArgs();

  // If no-tools mode is enabled, return empty array
  if (args.noTools) {
    return [];
  }

  // Get all available tool names
  const builtinToolNames = BUILTIN_TOOLS.map((tool) => tool.name);
  const mcpToolNames =
    MCPService.getInstance()
      ?.getTools()
      .map((tool) => tool.name) ?? [];
  const allToolNames = [...builtinToolNames, ...mcpToolNames];

  // Filter out excluded tools based on permissions
  const allowedToolNames = filterExcludedTools(allToolNames);
  const allowedToolNamesSet = new Set(allowedToolNames);

  // Filter builtin tools
  const allowedBuiltinTools = BUILTIN_TOOLS.filter((tool) =>
    allowedToolNamesSet.has(tool.name)
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
            { type: param.type, description: param.description },
          ])
        ),
        required: Object.entries(tool.parameters)
          .filter(([_, param]) => param.required)
          .map(([key, _]) => key),
      },
    },
  }));

  // Add filtered MCP tools if not in no-tools mode
  const mcpTools = MCPService.getInstance()?.getTools() ?? [];
  const allowedMcpTools = mcpTools.filter((tool) =>
    allowedToolNamesSet.has(tool.name)
  );

  allTools.push(
    ...allowedMcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))
  );

  return allTools;
}

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onContentComplete?: (content: string) => void;
  onToolStart?: (toolName: string, toolArgs?: any) => void;
  onToolResult?: (result: string, toolName: string) => void;
  onToolError?: (error: string, toolName?: string) => void;
  onToolPermissionRequest?: (
    toolName: string,
    toolArgs: any,
    requestId: string
  ) => void;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  argumentsStr: string;
  startNotified: boolean;
}

function getDefaultCompletionOptions(
  opts?: CompletionOptions
): Partial<ChatCompletionCreateParamsStreaming> {
  if (!opts) return {};
  return {
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    frequency_penalty: opts.frequencyPenalty,
    presence_penalty: opts.presencePenalty,
    top_p: opts.topP,
  };
}

// Process a single streaming response and return whether we need to continue
async function processStreamingResponse(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  abortController: AbortController,
  callbacks?: StreamCallbacks,
  isHeadless?: boolean,
  tools?: ChatCompletionTool[]
): Promise<{
  content: string;
  finalContent: string; // Added field for final content only
  toolCalls: ToolCall[];
  shouldContinue: boolean;
}> {
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
      abortController.signal
    );
  };

  let aiResponse = "";
  let finalContent = "";
  const toolCallsMap = new Map<string, ToolCall>();
  const indexToIdMap = new Map<number, string>(); // Track index to ID mapping
  let firstTokenTime: number | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let hasToolCalls = false;

  try {
    const streamWithBackoff = withExponentialBackoff(
      streamFactory,
      abortController.signal
    );

    let chunkCount = 0;
    for await (const chunk of streamWithBackoff) {
      chunkCount++;

      logger.debug("Received chunk", { chunkCount, chunk });

      // Track first token time
      if (
        firstTokenTime === null &&
        (chunk.choices[0].delta.content || chunk.choices[0].delta.tool_calls)
      ) {
        firstTokenTime = Date.now();
        telemetryService.recordResponseTime(
          firstTokenTime - requestStartTime,
          model.model,
          "time_to_first_token",
          (tools?.length || 0) > 0
        );
      }

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

      // Safety check: ensure chunk has the expected structure
      if (!chunk.choices || !chunk.choices[0]) {
        logger.warn("Malformed chunk received - missing choices", { chunk });
        continue;
      }

      const choice = chunk.choices[0];
      if (!choice.delta) {
        logger.warn("Malformed chunk received - missing delta", { chunk });
        continue;
      }

      // Handle content streaming
      if (choice.delta.content) {
        const content = choice.delta.content;
        aiResponse += content;

        // Call the onContent callback if provided
        if (callbacks?.onContent) {
          callbacks.onContent(content);
        } else if (!isHeadless) {
          // Print content directly if no callback
          process.stdout.write(content);
        }
      }

      // Handle tool calls
      if (choice.delta.tool_calls) {
        hasToolCalls = true;
        for (const toolCallDelta of choice.delta.tool_calls) {
          let toolCallId: string | undefined;

          // If we have an ID, use it and map the index
          if (toolCallDelta.id) {
            toolCallId = toolCallDelta.id;
            if (toolCallDelta.index !== undefined && toolCallId) {
              indexToIdMap.set(toolCallDelta.index, toolCallId);
            }
          } else if (toolCallDelta.index !== undefined) {
            // No ID, but we have an index - look up the ID from our map
            toolCallId = indexToIdMap.get(toolCallDelta.index);
          }

          if (!toolCallId) {
            logger.warn("Tool call delta without ID or valid index mapping", {
              toolCallDelta,
            });
            continue;
          }

          // Create tool call entry if it doesn't exist
          if (!toolCallsMap.has(toolCallId)) {
            toolCallsMap.set(toolCallId, {
              id: toolCallId,
              name: "",
              arguments: null,
              argumentsStr: "",
              startNotified: false,
            });
          }

          const toolCall = toolCallsMap.get(toolCallId);
          if (!toolCall) {
            logger.warn("Tool call not found in map", { toolCallId });
            continue;
          }

          // Update name
          if (toolCallDelta.function?.name) {
            toolCall.name = toolCallDelta.function.name;
          }

          // Accumulate arguments
          if (toolCallDelta.function?.arguments) {
            toolCall.argumentsStr += toolCallDelta.function.arguments;

            // Try to parse when we might have complete JSON
            try {
              toolCall.arguments = JSON.parse(toolCall.argumentsStr);

              // Don't notify onToolStart here anymore - wait until after permission check
              toolCall.startNotified = true;
            } catch (e) {
              // JSON not complete yet, continue
            }
          }
        }
      }
    }

    const responseEndTime = Date.now();
    const totalDuration = responseEndTime - requestStartTime;

    // Record API request metrics
    const cost = calculateTokenCost(inputTokens, outputTokens, model.model);

    telemetryService.recordTokenUsage(inputTokens, "input", model.model);
    telemetryService.recordTokenUsage(outputTokens, "output", model.model);
    telemetryService.recordCost(cost, model.model);

    telemetryService.recordResponseTime(
      totalDuration,
      model.model,
      "total_response_time",
      (tools?.length || 0) > 0
    );

    // Log API request event
    telemetryService.logApiRequest(
      model.model,
      totalDuration,
      true, // success
      undefined, // no error
      inputTokens,
      outputTokens,
      cost
    );

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
    telemetryService.logApiRequest(
      model.model,
      errorDuration,
      false, // failed
      error.message || String(error)
    );

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
  callbacks?: StreamCallbacks
) {
  logger.debug("streamChatResponse called", {
    model,
    historyLength: chatHistory.length,
    hasCallbacks: !!callbacks,
  });

  const args = parseArgs();
  const isHeadless = args.isHeadless;
  const tools = getAllTools();

  logger.debug("Tools prepared", {
    toolCount: tools.length,
    toolNames: tools.map((t) => t.function.name),
  });

  let fullResponse = "";
  let finalResponse = "";

  while (true) {
    logger.debug("Starting conversation iteration");

    // Get response from LLM
    const { content, finalContent, toolCalls, shouldContinue } =
      await processStreamingResponse(
        chatHistory,
        model,
        llmApi,
        abortController,
        callbacks,
        isHeadless,
        tools
      );

    fullResponse += content;

    // In headless mode, we only want to collect the final content after all tool calls
    if (!shouldContinue) {
      // This is the final message, so it's the content we want to show
      finalResponse = content;
    } else if (isHeadless && content) {
      // In headless mode with tool calls, we still want to show any text content
      // since we won't be making follow-up requests
      finalResponse = content;
    }

    // Add newline after content if needed
    if (!callbacks?.onContent && !isHeadless && content) {
      logger.info("");
    }

    // Notify content complete
    if (content && callbacks?.onContentComplete) {
      callbacks.onContentComplete(content);
    }

    // Add assistant message to history
    if (toolCalls.length > 0) {
      const toolCallsForHistory: ChatCompletionMessageToolCall[] =
        toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));

      chatHistory.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCallsForHistory,
      });

      // Execute tool calls
      for (const toolCall of toolCalls) {
        try {
          logger.debug("Checking tool permissions", {
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          // Check tool permissions
          const permissionCheck = checkToolPermission({
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          // Notify tool start immediately - before permission check
          // This ensures the UI shows the tool call even if it's rejected
          if (callbacks?.onToolStart) {
            callbacks.onToolStart(toolCall.name, toolCall.arguments);
          }

          let approved = false;

          if (permissionCheck.permission === "allow") {
            approved = true;
          } else if (permissionCheck.permission === "ask") {
            // In headless mode, exit immediately with instructions
            const tool = BUILTIN_TOOLS.find((t) => t.name === toolCall.name);
            const toolName = tool?.displayName || toolCall.name;
            if (isHeadless) {
              console.error(
                `Error: Tool '${toolName}' requires permission but cn is running in headless mode.`
              );
              console.error(
                `If you want to allow this tool, use --allow ${toolName}.`
              );
              console.error(
                `If you don't want the tool to be included, use --exclude ${toolName}.`
              );

              process.exit(1);
            }

            // Request permission from user
            if (callbacks?.onToolPermissionRequest) {
              // Use the proper toolPermissionManager API
              const toolCallRequest = {
                name: toolCall.name,
                arguments: toolCall.arguments,
              };

              // Set up listener for permissionRequested event
              const handlePermissionRequested = (event: {
                requestId: string;
                toolCall: { name: string; arguments: any };
              }) => {
                if (event.toolCall.name === toolCall.name) {
                  toolPermissionManager.off(
                    "permissionRequested",
                    handlePermissionRequested
                  );
                  // Notify UI about permission request
                  callbacks.onToolPermissionRequest!(
                    event.toolCall.name,
                    event.toolCall.arguments,
                    event.requestId
                  );
                }
              };

              toolPermissionManager.on(
                "permissionRequested",
                handlePermissionRequested
              );

              // Request permission using the proper API
              const permissionResult =
                await toolPermissionManager.requestPermission(toolCallRequest);

              approved = permissionResult.approved;
            } else {
              // Fallback: deny if no UI callback available
              approved = false;
            }
          } else if (permissionCheck.permission === "exclude") {
            // This shouldn't happen as excluded tools are filtered out earlier
            approved = false;
          }

          if (!approved) {
            const deniedMessage = `Permission denied by user`;
            logger.info("Tool call denied", {
              name: toolCall.name,
              arguments: toolCall.arguments,
            });

            chatHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: deniedMessage,
            });

            if (callbacks?.onToolResult) {
              callbacks.onToolResult(deniedMessage, toolCall.name);
            }
            continue;
          }

          logger.debug("Executing tool", {
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          const toolResult = await executeToolCall({
            name: toolCall.name,
            arguments: toolCall.arguments,
          });

          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });

          if (callbacks?.onToolResult) {
            callbacks.onToolResult(toolResult, toolCall.name);
          }
        } catch (error) {
          const errorMessage = `Error executing tool ${toolCall.name}: ${
            error instanceof Error ? error.message : String(error)
          }`;

          logger.error("Tool execution failed", {
            name: toolCall.name,
            error: errorMessage,
          });

          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorMessage,
          });

          if (callbacks?.onToolError) {
            callbacks.onToolError(errorMessage, toolCall.name);
          }
        }
      }
    } else if (content) {
      // Just content, no tools
      chatHistory.push({ role: "assistant", content });
    }

    // Check if we should continue
    if (!shouldContinue) {
      logger.debug("Conversation complete - no more tool calls");
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
