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
import { chatCompletionStreamWithBackoff } from "./util/exponentialBackoff.js";

dotenv.config();

export function getAllTools() {
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
  const args = parseArgs();
  const isHeadless = args.isHeadless;
  // Prepare tools for the API call
  const toolsForRequest = getAllTools();

  let fullResponse = "";
  let currentToolCalls: TODO[] = [];
  let shouldContinueConversation = true;

  while (shouldContinueConversation) {
    let stream;

    try {
      // fs.appendFileSync(
      //   "chat.log",
      //   "---\n\n" + JSON.stringify(chatHistory, null, 2) + "\n\n"
      // );
      stream = await chatCompletionStreamWithBackoff(
        llmApi,
        {
          model,
          messages: chatHistory,
          stream: true,
          tools: toolsForRequest,
        },
        abortController.signal
      );
    } catch (error: any) {
      console.error(
        chalk.red("Error in streamChatResponse:"),
        chalk.red(error.message)
      );
      throw error;
    }

    let aiResponse = "";
    currentToolCalls = [];
    let currentToolCallId = "";
    let toolArguments = "";

    try {
      for await (const chunk of stream) {
        // Check if we should abort
        if (abortController?.signal.aborted) {
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
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      // Handle AbortError gracefully - this is expected when user cancels
      if (error.name === 'AbortError' || abortController?.signal.aborted) {
        // Stream was aborted, this is expected behavior
        return fullResponse;
      }
      // For other errors, re-throw them
      throw error;
    }

    if (!callbacks?.onContent && !isHeadless) {
      console.info(); // Add a newline after the response
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
      chatHistory.push({ role: "assistant", content: aiResponse });
      // Also notify content complete for standalone messages
      if (callbacks?.onContentComplete) {
        callbacks.onContentComplete(aiResponse);
      }
    }

    // If we have tool calls, execute them
    if (currentToolCalls.length > 0) {
      for (const toolCall of currentToolCalls) {
        try {
          // Execute the tool
          const toolResult = await executeToolCall({
            name: toolCall.name,
            arguments: toolCall.arguments,
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
    } else {
      // No more tool calls, end the conversation
      shouldContinueConversation = false;
    }
  }

  return fullResponse;
}