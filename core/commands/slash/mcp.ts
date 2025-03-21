import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { ChatMessage, SlashCommand } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
export function constructMcpSlashCommand(
  client: Client,
  name: string,
  description?: string,
  args?: string[],
): SlashCommand {
  return {
    name,
    description: description ?? "MCP Prompt",
    params: {},
    run: async function* (context) {
      const argsObject: { [key: string]: string } = {};
      const userInput = context.input.split(" ").slice(1).join(" ");
      if (args) {
        args.forEach((arg, i) => {
          argsObject[arg] = ""; // userInput
        });
      }

      const result = await client.getPrompt({ name, arguments: argsObject });

      const messages: ChatMessage[] = result.messages.map((msg) => {
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

      const reversedMessages = [...messages].reverse();
      const messageToAppendInput =
        reversedMessages.find((m) => m.role === "user") ??
        reversedMessages.find((m) => m.role === "assistant") ??
        reversedMessages[0];
      messageToAppendInput.content += ` ${userInput}`;

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
