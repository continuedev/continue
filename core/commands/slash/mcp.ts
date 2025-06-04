import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { ChatMessage, MCPPrompt, SlashCommand } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
export function mcpPromptToSlashCommand(
  client: Client,
  prompt: MCPPrompt,
): SlashCommand {
  return {
    name: prompt.name,
    description: prompt.description ?? "MCP Prompt",
    params: {},
    run: async function* (context) {
      const argsObject: { [key: string]: string } = {};
      const userInput = context.input.split(" ").slice(1).join(" ");
      if (prompt.arguments) {
        const argNames = prompt.arguments.map((a) => a.name);
        argNames.forEach((arg, i) => {
          argsObject[arg] = ""; // userInput
        });
      }

      const result = await client.getPrompt({
        name: prompt.name,
        arguments: argsObject,
      });
      const mcpMessages: PromptMessage[] = result.messages;
      const messages: ChatMessage[] = mcpMessages.map((msg) => {
        if (msg.content.type !== "text") {
          throw new Error(
            "Continue currently only supports text prompts through MCP",
          );
        }
        return {
          content: msg.content.text,
          role: msg.role,
        };
      });

      if (messages.length === 0) {
        yield "The MCP prompt returned no messages";
        return;
      }

      if (userInput) {
        const lastMessage = messages.at(-1);
        if (!lastMessage || lastMessage.role !== "user") {
          messages.push({
            role: "user",
            content: userInput,
          });
        } else {
          let newContent = renderChatMessage(lastMessage);
          if (newContent) {
            newContent += "\n\n";
          }
          newContent += userInput;
          lastMessage.content = newContent;
        }
      }

      for await (const chunk of context.llm.streamChat(
        messages,
        new AbortController().signal,
        context.completionOptions,
      )) {
        yield renderChatMessage(chunk);
      }
    },
  };
}
