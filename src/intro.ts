import chalk from "chalk";
import * as fs from "fs";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { MCPService } from "./mcp.js";
import { getAllTools } from "./streamChatResponse.js";
import { Assistant, type AssistantConfig } from "@continuedev/sdk";

export function loadSystemMessage(
  assistant: AssistantConfig
): string | undefined {
  return assistant.rules
    ?.filter((rule) => !!rule)
    .map((rule) => (typeof rule === "string" ? rule : rule?.rule))
    .join("\n");
}

export function introMessage(assistant: Assistant, mcpService: MCPService) {
  const assistantConfig = assistant.config;

  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  console.log(chalk.cyan(CONTINUE_ASCII_ART));

  console.log(`\n${chalk.bold.blue(`Assistant: ${assistantConfig.name}`)}`);
  console.log(`${chalk.blue(`Model: ${assistant.getModel()}`)}\n`);

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
  for (const prompt of assistantConfig.prompts ?? []) {
    console.log(`- /${prompt?.name}: ${prompt?.description}`);
  }
  for (const prompt of mcpPrompts) {
    console.log(`- /${prompt.name}: ${prompt.description}`);
  }
  console.log("");

  if (assistantConfig.rules?.length) {
    console.log(
      chalk.yellow("\nAssistant rules: " + assistantConfig.rules.length)
    );
  }

  if (assistantConfig.mcpServers?.length) {
    console.log(chalk.yellow("\nMCP Servers:"));
    assistantConfig.mcpServers.forEach((server: any) => {
      console.log(`- ${chalk.cyan(server?.name)}`);
    });
  }
  console.log("");
}
