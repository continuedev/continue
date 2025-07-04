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

export function stringifyMcpPrompt(
  prompt: Awaited<ReturnType<typeof Client.prototype.getPrompt>>,
): string {
  const { messages } = prompt;
  let stringified = "";
  for (const message of messages) {
    if (message.content.type === "text") {
      stringified += `<${message.content.role}/>\n${message.content.text}\n<${message.content.role}/>`;
    } else {
      console.warn(
        `MCP Prompt conversion warning: ${message.content.type} content is not yet supported, message skipped`,
      );
    }
  }
  return stringified;
}
