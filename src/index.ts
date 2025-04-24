#!/usr/bin/env node

import { ContinueHubClient } from "@continuedev/hub";

import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { parseArgs } from "./args.js";
import { ensureAuthenticated } from "./auth/ensureAuth.js";
import { loadAuthConfig } from "./auth/workos.js";
import { env } from "./env.js";
import { introMessage, loadAssistant, loadSystemMessage } from "./intro.js";
import { MCPService } from "./mcp.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";

// Parse command line arguments
const args = parseArgs();

// client
//   .listAssistants({
//     alwaysUseProxy: "true",
//   })
//   .then((result) => {
//     console.log("API result:", result);
//   })
//   .catch((error) => {
//     console.log("API error:", error);
//   });

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
  const assistant = await loadAssistant(hub, args.assistantPath);

  const mcpService = await MCPService.create(assistant);

  // Only show intro message if not in headless mode
  if (!args.isHeadless) {
    introMessage(assistant, mcpService);
  }

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
        chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`)
      );
    }
  }
}

chat().catch((error) =>
  console.error(chalk.red(`Fatal error: ${error.message}`))
);
