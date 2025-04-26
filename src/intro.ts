import { AssistantUnrolled } from "@continuedev/config-yaml";
import { ContinueHubClient } from "@continuedev/hub";

import chalk from "chalk";
import * as fs from "fs";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { MCPService } from "./mcp.js";
import { getAllTools, getLlmFromAssistant } from "./streamChatResponse.js";

export async function loadAssistant(
  hub: ContinueHubClient,
  filepathOrSlug: string
): Promise<AssistantUnrolled> {
  console.log("Loading assistant ", filepathOrSlug);
  if (!fs.existsSync(filepathOrSlug)) {
    // Assume it's a slug
    console.log("Loading assistant from slug");
    return await hub.loadAssistant(filepathOrSlug);
  }

  const content = fs.readFileSync(filepathOrSlug, "utf-8");
  console.log("Loading assistant from file");
  const assistant = await hub.loadAssistantFromContent(content);
  console.log("loaded: ", assistant.name);
  return assistant;
}

export function loadSystemMessage(
  assistant: AssistantUnrolled
): string | undefined {
  return assistant.rules
    ?.filter((rule) => !!rule)
    .map((rule) => (typeof rule === "string" ? rule : rule.rule))
    .join("\n");
}

export function introMessage(
  assistant: AssistantUnrolled,
  mcpService: MCPService
) {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  console.log(chalk.cyan(CONTINUE_ASCII_ART));

  const { model } = getLlmFromAssistant(assistant);
  console.log(`\n${chalk.bold.blue(`Assistant: ${assistant.name}`)}`);
  console.log(`${chalk.blue(`Model: ${model}`)}\n`);

  console.log(chalk.yellow("Available tools:"));
  getAllTools().forEach((tool) => {
    console.log(
      `- ${chalk.green(tool.function.name)}: ${tool.function.description ?? ""}`
    );
  });
  mcpTools.forEach((tool) => {
    console.log(`- ${chalk.green(tool.name)}: ${tool.description}`);
  });
  console.log("");

  console.log(chalk.yellow("\nAvailable slash commands:"));
  console.log("- /exit: Exit the chat");
  console.log("- /clear: Clear the chat history");
  console.log("- /help: Show help message");
  console.log("- /models: Show available models");
  console.log("- /login: Authenticate with your account");
  console.log("- /logout: Sign out of your current session");
  console.log("- /whoami: Check who you're currently logged in as");
  for (const prompt of assistant.prompts ?? []) {
    console.log(`- /${prompt.name}: ${prompt.description}`);
  }
  for (const prompt of mcpPrompts) {
    console.log(`- /${prompt.name}: ${prompt.description}`);
  }
  console.log("");

  if (assistant.rules?.length) {
    console.log(chalk.yellow("\nAssistant rules: " + assistant.rules.length));
  }

  if (assistant.mcpServers?.length) {
    console.log(chalk.yellow("\nMCP Servers:"));
    assistant.mcpServers.forEach((server) => {
      console.log(`- ${chalk.cyan(server.name)}`);
    });
  }
  console.log("");
}
