import { SlashCommandDescWithSource } from "core";
import { IIdeMessenger } from "../../../../context/IdeMessenger";

export async function renderMcpPrompt(
  command: SlashCommandDescWithSource,
  ideMessenger: IIdeMessenger,
  userInput?: string,
) {
  // TODO add support for mcp prompt args using command.mcpArgs
  const args: { [key: string]: string } = {};
  if (command.mcpArgs) {
    command.mcpArgs.forEach((arg, i) => {
      args[arg.name] = "";
    });
  }
  const response = await ideMessenger.request("mcp/getPrompt", {
    serverName: command.mcpServerName!,
    promptName: command.name,
    args: args,
  });
  if (response.status === "success") {
    let renderedPrompt = response.content.prompt;
    if (userInput) {
      renderedPrompt += `\n\n${userInput}`;
    }
    return renderedPrompt;
  } else {
    throw new Error(
      `Failed to get MCP prompt for slash command ${command.name}`,
    );
  }
}
