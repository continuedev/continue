import { BaseLlmApi } from "@continuedev/openai-adapters";
import chalk from "chalk";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources.mjs";
import { parseArgs } from "./args.js";
import { MCPService } from "./mcp.js";
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

  const allTools: ChatCompletionTool[] = BUILTIN_TOOLS.map((tool) => ({
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

  // Add MCP tools if not in no-tools mode
  const mcpTools = MCPService.getInstance()?.getTools() ?? [];
  allTools.push(
    ...mcpTools.map((tool) => ({
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

type TODO = any;

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onContentComplete?: (content: string) => void;
  onToolStart?: (toolName: string, toolArgs?: any) => void;
  onToolResult?: (result: string, toolName: string) => void;
  onToolError?: (error: string, toolName?: string) => void;
}

// Define a function to handle streaming responses with tool calling
export async function streamChatResponse(
  chatHistory: ChatCompletionMessageParam[],
  model: string,
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
  // Prepare tools for the API call
  const toolsForRequest = getAllTools();
  logger.debug("Tools prepared", {
    toolCount: toolsForRequest.length,
    toolNames: toolsForRequest.map((t) => t.function.name),
  });

  let fullResponse = "";
  let currentToolCalls: TODO[] = [];
  let shouldContinueConversation = true;

  while (shouldContinueConversation) {
    logger.debug("Starting new conversation iteration", {
      iterationNumber:
        chatHistory.filter((m) => m.role === "assistant").length + 1,
      hasToolCalls: currentToolCalls.length > 0,
      previousToolCount: currentToolCalls.length,
    });
    // Factory function to create the stream generator
    const streamFactory = async () => {
      logger.debug("Creating chat completion stream", {
        model,
        messageCount: chatHistory.length,
        toolCount: toolsForRequest.length,
      });
      return await chatCompletionStreamWithBackoff(
        llmApi,
        {
          model,
          messages: chatHistory,
          stream: true,
          tools: toolsForRequest,
        },
        abortController.signal
      );
    };

    let aiResponse = "";
    currentToolCalls = [];
    let currentToolCallId = "";
    let toolArguments = "";
    logger.debug("Initialized iteration variables");

    try {
      // Use the exponential backoff wrapper for the entire stream
      const streamWithBackoff = withExponentialBackoff(
        streamFactory,
        abortController.signal
      );

      let chunkCount = 0;
      for await (const chunk of streamWithBackoff) {
        chunkCount++;
        logger.debug("Received stream chunk", {
          chunkNumber: chunkCount,
          hasContent: !!chunk.choices[0].delta.content,
          contentLength: chunk.choices[0].delta.content?.length || 0,
          hasToolCalls: !!chunk.choices[0].delta.tool_calls,
          toolCallCount: chunk.choices[0].delta.tool_calls?.length || 0,
        });
        // Check if we should abort
        if (abortController?.signal.aborted) {
          logger.debug("Stream aborted");
          break;
        }

        // Handle regular content
        if (chunk.choices[0].delta.content) {
          const content = chunk.choices[0].delta.content;
          if (callbacks?.onContent) {
            callbacks.onContent(content);
          } else if (!isHeadless) {
            process.stdout.write(chalk.white(content));
          }
          aiResponse += content;
          fullResponse += content;
        }

        // Handle tool calls
        if (chunk.choices[0].delta.tool_calls) {
          for (const toolCallDelta of chunk.choices[0].delta.tool_calls) {
            // Initialize a new tool call if we get an index and id
            if (toolCallDelta.index !== undefined && toolCallDelta.id) {
              if (!currentToolCalls[toolCallDelta.index]) {
                logger.debug("Initializing new tool call", {
                  index: toolCallDelta.index,
                  id: toolCallDelta.id,
                });
                currentToolCalls[toolCallDelta.index] = {
                  id: toolCallDelta.id,
                  name: "",
                  arguments: {},
                  startNotified: false,
                };
              }
              currentToolCallId = toolCallDelta.id;
            }

            // Add function name if present
            if (toolCallDelta.function?.name) {
              const toolCall = currentToolCalls.find(
                (tc) => tc.id === currentToolCallId
              );
              if (toolCall) {
                if (!toolCall.name) {
                  logger.debug("Setting tool name", {
                    toolId: currentToolCallId,
                    name: toolCallDelta.function.name,
                  });
                  toolCall.name = toolCallDelta.function.name;
                  toolCall.startNotified = false;
                }
              }
            }

            // Collect function arguments
            if (toolCallDelta.function?.arguments) {
              const toolCall = currentToolCalls.find(
                (tc) => tc.id === currentToolCallId
              );
              if (toolCall) {
                // Accumulate arguments as string to later parse as JSON
                toolArguments += toolCallDelta.function.arguments;

                try {
                  // Try to parse complete JSON
                  const parsed = JSON.parse(toolArguments);
                  toolCall.arguments = parsed;
                  logger.debug("Successfully parsed tool arguments", {
                    toolName: toolCall.name,
                    argumentKeys: Object.keys(parsed),
                  });

                  // Notify start if we haven't already and have both name and args
                  if (toolCall.name && !toolCall.startNotified) {
                    toolCall.startNotified = true;
                    if (callbacks?.onToolStart) {
                      callbacks.onToolStart(toolCall.name, toolCall.arguments);
                    } else if (!isHeadless) {
                      process.stdout.write(
                        `\n${chalk.yellow("[Using tool:")} ${chalk.yellow.bold(
                          toolCall.name
                        )}${chalk.yellow("]")}`
                      );
                    }
                  }
                } catch (e) {
                  // Not complete JSON yet, continue collecting
                  logger.debug("Tool arguments not yet complete JSON", {
                    arguments: toolArguments,
                  });
                }
              }
            }
          }
        }
      }
      logger.debug("Stream iteration complete", {
        totalChunks: chunkCount,
        responseLength: aiResponse.length,
        toolCallsCollected: currentToolCalls.length,
      });
    } catch (error: any) {
      // Handle AbortError gracefully - this is expected when user cancels
      if (error.name === "AbortError" || abortController?.signal.aborted) {
        logger.debug("Stream aborted by user");
        // Stream was aborted, this is expected behavior
        return fullResponse;
      }
      // For other errors, re-throw them
      logger.error(chalk.red("Error in streamChatResponse:"), error);
      throw error;
    }

    if (!callbacks?.onContent && !isHeadless) {
      logger.info(""); // Add a newline after the response
    }

    // Notify that content is complete if we have content and are about to process tool calls
    if (
      aiResponse.trim() &&
      currentToolCalls.length > 0 &&
      callbacks?.onContentComplete
    ) {
      callbacks.onContentComplete(aiResponse);
    }

    // Add the assistant's response to chat history if there's content or tool calls
    if (currentToolCalls.length > 0) {
      logger.debug("Adding assistant response with tool calls", {
        toolCount: currentToolCalls.length,
        toolNames: currentToolCalls.map((tc) => tc.name),
        hasContent: !!aiResponse.trim(),
      });
      const toolCalls: ChatCompletionMessageToolCall[] = currentToolCalls.map(
        (tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })
      );
      chatHistory.push({
        role: "assistant",
        content: aiResponse,
        tool_calls: toolCalls,
      });
    } else if (aiResponse.trim()) {
      // Only add assistant response if there's actual content
      logger.debug("Adding assistant response without tool calls", {
        contentLength: aiResponse.length,
      });
      chatHistory.push({ role: "assistant", content: aiResponse });
      // Also notify content complete for standalone messages
      if (callbacks?.onContentComplete) {
        callbacks.onContentComplete(aiResponse);
      }
    } else {
      logger.debug("No content or tool calls to add to history");
    }

    // If we have tool calls, execute them
    if (currentToolCalls.length > 0) {
      logger.debug("Executing tool calls", {
        count: currentToolCalls.length,
      });
      for (const toolCall of currentToolCalls) {
        try {
          logger.debug("Executing tool", {
            name: toolCall.name,
            arguments: toolCall.arguments,
          });
          // Execute the tool
          const toolResult = await executeToolCall({
            name: toolCall.name,
            arguments: toolCall.arguments,
          });
          logger.debug("Tool execution complete", {
            name: toolCall.name,
            resultLength: toolResult.length,
          });

          // Add tool result to chat history
          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });

          if (callbacks?.onToolResult) {
            callbacks.onToolResult(toolResult, toolCall.name);
          } else if (!isHeadless) {
            console.info(chalk.green(toolResult) + "\n");
          }
        } catch (error) {
          const errorMessage = `Error executing tool ${toolCall.name}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          logger.debug("Tool execution failed", {
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
          } else if (!isHeadless) {
            console.info(
              `${chalk.red("[Tool error:")} ${chalk.red(
                errorMessage
              )}${chalk.red(")")}`
            );
          }
        }
      }

      // Continue the conversation with the tool results
      shouldContinueConversation = true;
      logger.debug("Continuing conversation after tool execution");
    } else {
      // No more tool calls, end the conversation
      shouldContinueConversation = false;
      logger.debug("Ending conversation - no more tool calls");
    }
  }

  logger.debug("streamChatResponse complete", {
    totalResponseLength: fullResponse.length,
    totalMessages: chatHistory.length,
  });
  return fullResponse;
}
