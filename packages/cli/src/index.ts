#!/usr/bin/env node

import { AssistantUnrolled } from "@continuedev/config-yaml";
import { ContinueHubClient } from "@continuedev/hub";

import chalk from "chalk";
import * as fs from "fs";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as os from "os";
import * as path from "path";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { ensureAuthenticated } from "./auth/ensureAuth.js";
import { loadAuthConfig } from "./auth/workos.js";
import { client } from "./client.js";
import { env } from "./env.js";
import { MCPService } from "./mcp.js";
import { handleSlashCommands } from "./slashCommands.js";
import {
  getAllTools,
  getLlmFromAssistant,
  streamChatResponse,
} from "./streamChatResponse.js";

client
  .listAssistants({
    alwaysUseProxy: "true",
  })
  .then((result) => {
    console.log("API result:", result);
  })
  .catch((error) => {
    console.log("API error:", error);
  });

async function loadAssistant(
  hub: ContinueHubClient,
): Promise<AssistantUnrolled> {
  const filepathOrSlug =
    process.argv[2] || path.join(os.homedir(), ".continue", "config.yaml");

  if (!fs.existsSync(filepathOrSlug)) {
    // Assume it's a slug
    return await hub.loadAssistant(filepathOrSlug);
  }

  const content = fs.readFileSync(filepathOrSlug, "utf-8");
  const assistant = await hub.loadAssistantFromContent(content);
  return assistant;
}

function loadSystemMessage(assistant: AssistantUnrolled): string | undefined {
  return assistant.rules
    ?.filter((rule) => !!rule)
    .map((rule) => (typeof rule === "string" ? rule : rule.rule))
    .join("\n");
}

function introMessage(assistant: AssistantUnrolled, mcpService: MCPService) {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  console.log(chalk.cyan(CONTINUE_ASCII_ART));

  const { model } = getLlmFromAssistant(assistant);
  console.log(`\n${chalk.bold.blue(`Assistant: ${assistant.name}`)}`);
  console.log(`${chalk.blue(`Model: ${model}`)}\n`);

  console.log(chalk.yellow("Available tools:"));
  getAllTools().forEach((tool) => {
    console.log(
      `- ${chalk.green(tool.function.name)}: ${tool.function.description ?? ""}`,
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

async function chat() {
  // Ensure authenticated
  const isAuthenticated = await ensureAuthenticated(true);
  const authConfig = loadAuthConfig();

  const hub = new ContinueHubClient({
    apiKey: authConfig.accessToken,
    currentUserSlug: "e2e",
    orgScopeId: null,
    apiBase: env.apiBase,
  });

  // Load assistant
  const assistant = await loadAssistant(hub);

  const mcpService = await MCPService.create(assistant);

  introMessage(assistant, mcpService);

  // Rules
  const chatHistory: ChatCompletionMessageParam[] = [];
  const systemMessage = loadSystemMessage(assistant);
  if (systemMessage) {
    chatHistory.push({ role: "system", content: systemMessage });
  }

  while (true) {
    // Get user input
    let userInput = readlineSync.question(`\n${chalk.bold.green("You:")} `);

    // Handle slash commands
    const commandResult = handleSlashCommands(userInput, assistant);
    if (commandResult) {
      if (commandResult.exit) {
        break;
      }

      console.log(`\n${chalk.italic.gray(commandResult.output ?? "")}`);

      if (commandResult.newInput) {
        userInput = commandResult.newInput;
      } else {
        continue;
      }
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: userInput });

    // Get AI response with potential tool usage
    console.log(`\n${chalk.bold.blue("Assistant:")}`);

    try {
      await streamChatResponse(chatHistory, assistant);
    } catch (e: any) {
      console.error(`\n${chalk.red(`Error: ${e.message}`)}`);
      console.log(
        chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`),
      );
    }
  }
}

chat().catch((error) =>
  console.error(chalk.red(`Fatal error: ${error.message}`)),
);
