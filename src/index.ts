#!/usr/bin/env node

import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { parseArgs } from "./args.js";
import { initializeAssistant } from "./assistant.js";
import { ensureAuthenticated } from "./auth/ensureAuth.js";
import { loadAuthConfig, ensureOrganization } from "./auth/workos.js";
import { introMessage } from "./intro.js";
import { configureLogger } from "./logger.js";
import { loadSession, saveSession } from "./session.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";
import { constructSystemMessage } from "./systemMessage.js";
import { startTUIChat } from "./ui/index.js";

// Parse command line arguments
const args = parseArgs();

// Configure logger based on headless mode
configureLogger(args.isHeadless);

async function chat() {
  const isAuthenticated = await ensureAuthenticated(true);

  if (!isAuthenticated) {
    console.error(chalk.red("Authentication failed. Exiting..."));
    process.exit(1);
  }

  const authConfig = loadAuthConfig();

  // Ensure organization is selected
  const authConfigWithOrg = await ensureOrganization(authConfig, args.isHeadless);

  // Initialize ContinueSDK and MCPService once
  const { config, llmApi, model, mcpService } = await initializeAssistant(
    authConfigWithOrg,
    args.configPath
  );

  // If not in headless mode, start the TUI chat (default)
  if (!args.isHeadless) {
    await startTUIChat(
      config,
      llmApi,
      model,
      mcpService,
      args.prompt,
      args.resume
    );
    return;
  }

  // Show intro message for headless mode
  introMessage(config, model, mcpService);

  // Rules
  let chatHistory: ChatCompletionMessageParam[] = [];

  // Load previous session if --resume flag is used
  if (args.resume) {
    const savedHistory = loadSession();
    if (savedHistory) {
      chatHistory = savedHistory;
      console.log(chalk.yellow("Resuming previous session..."));
    } else {
      console.log(chalk.yellow("No previous session found, starting fresh..."));
    }
  }

  // If no session loaded or not resuming, initialize with system message
  if (chatHistory.length === 0) {
    const rulesSystemMessage = ""; // TODO //assistant.systemMessage;
    const systemMessage = constructSystemMessage(rulesSystemMessage);
    if (systemMessage) {
      chatHistory.push({ role: "system", content: systemMessage });
    }
  }

  let isFirstMessage = true;
  while (true) {
    // When in headless mode, don't ask for user input
    if (!isFirstMessage && args.prompt && args.isHeadless) {
      break;
    }

    // Get user input
    let userInput =
      isFirstMessage && args.prompt
        ? args.prompt
        : readlineSync.question(`\n${chalk.bold.green("You:")} `);

    isFirstMessage = false;

    // Handle slash commands
    const commandResult = handleSlashCommands(userInput, config);
    if (commandResult) {
      if (commandResult.exit) {
        break;
      }

      // Note that `console.log` is shown in headless mode, `console.info` is not
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
    if (!args.isHeadless) {
      console.info(`\n${chalk.bold.blue("Assistant:")}`);
    }

    try {
      const abortController = new AbortController();
      const finalResponse = await streamChatResponse(
        chatHistory,
        model,
        llmApi,
        abortController
      );

      // In headless mode, only print the final response
      if (args.isHeadless && finalResponse.trim()) {
        console.log(finalResponse);
      }

      // Save session after each successful response
      saveSession(chatHistory);
    } catch (e: any) {
      console.error(`\n${chalk.red(`Error: ${e.message}`)}`);
      if (!args.isHeadless) {
        console.info(
          chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`)
        );
      }
    }
  }
}

chat().catch((error) =>
  console.error(chalk.red(`Fatal error: ${error.message}`))
);
