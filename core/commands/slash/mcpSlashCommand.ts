import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { SlashCommandWithSource } from "../../index.js";

export function constructMcpSlashCommand(
  client: Client,
  name: string,
  description?: string,
  args?: string[],
): SlashCommandWithSource {
  return {
    name,
    description: description ?? "MCP Prompt",
    source: "mcp-prompt",
    params: {},
  };
}

/**
 * Converts an MCP prompt's text messages into a single XML-like string with role tags.
 *
 * Unsupported message content types are skipped and a console warning is emitted for each skipped message.
 *
 * @param prompt - The prompt object returned by Client.prototype.getPrompt; its `messages` array is used.
 * @returns A string where each text message is serialized as `<role>\n<text>\n</role>` concatenated in message order.
 */
export function stringifyMcpPrompt(
  prompt: Awaited<ReturnType<typeof Client.prototype.getPrompt>>,
): string {
  const { messages } = prompt;
  let stringified = "";
  for (const message of messages) {
    if (message.content.type === "text") {
      const role = message.role;
      stringified += `<${role}>\n${message.content.text}\n</${role}>`;
    } else {
      console.warn(
        `MCP Prompt conversion warning: ${message.content.type} content is not yet supported, message skipped`,
      );
    }
  }
  return stringified;
}