import chalk from "chalk";
import * as dotenv from "dotenv";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources.mjs";
import { MCPService } from "./mcp.js";
import { executeToolCall } from "./tools.js";
import { BUILTIN_TOOLS } from "./tools/index.js";
import { ContinueClient } from "@continuedev/sdk";

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

// Define a function to handle streaming responses with tool calling
export async function streamChatResponse(
  chatHistory: ChatCompletionMessageParam[],
  assistant: ContinueClient["assistant"],
  client: ContinueClient["client"]
) {
  // Prepare tools for the API call
  const toolsForRequest = getAllTools();

  let aiResponse = "";
  let currentToolCalls: TODO[] = [];
  let shouldContinueConversation = true;

  while (shouldContinueConversation) {
    let stream;

    try {
      stream = await client.chat.completions.create({
        model: assistant.getModel(),
        messages: chatHistory,
        stream: true,
        tools: toolsForRequest,
      });
    } catch (error: any) {
      console.error(
        chalk.red("Error in streamChatResponse:"),
        chalk.red(error.message)
      );
      process.exit(1);
    }

    aiResponse = "";
    currentToolCalls = [];
    let currentToolCallId = "";
    let toolArguments = "";

    for await (const chunk of stream) {
      // Handle regular content
      if (chunk.choices[0].delta.content) {
        const content = chunk.choices[0].delta.content;
        process.stdout.write(chalk.white(content));
        aiResponse += content;
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
                process.stdout.write(
                  `\n${chalk.yellow("[Using tool:")} ${chalk.yellow.bold(
                    toolCall.name
                  )}${chalk.yellow("]")}`
                );
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
              } catch (e) {
                // Not complete JSON yet, continue collecting
              }
            }
          }
        }
      }
    }

    console.info(); // Add a newline after the response

    // Add the tool calls to the chat history
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
        content: "",
        tool_calls: toolCalls,
      });
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

          console.info(chalk.green(toolResult) + "\n");
        } catch (error) {
          const errorMessage = `Error executing tool ${toolCall.name}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: errorMessage,
          });
          console.info(
            `${chalk.red("[Tool error:")} ${chalk.red(errorMessage)}${chalk.red(
              ")"
            )}`
          );
        }
      }

      // Continue the conversation with the tool results
      shouldContinueConversation = true;
    } else {
      // No more tool calls, end the conversation
      shouldContinueConversation = false;
    }

    // Add the assistant's response to chat history before any tool calls
    chatHistory.push({ role: "assistant", content: aiResponse });
  }

  return aiResponse;
}
