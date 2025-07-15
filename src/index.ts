#!/usr/bin/env node

import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { parseArgs } from "./args.js";
import { ensureAuthenticated } from "./auth/ensureAuth.js";
import { initializeAssistant } from "./assistant.js";
import { loadAuthConfig } from "./auth/workos.js";
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

  // This was the previous default behavior, but currently the SDK
  // only supports slugs, so we've disabled reading local assistant files

  // if (fs.existsSync(args.assistantPath)) {
  // // If it's a file, load it directly
  // console.info(
  //   chalk.yellow(`Loading assistant from file: ${args.assistantPath}`)
  // );
  // // We need to extract the assistant slug from the yaml to use with the SDK
  // // For now, let's just use a placeholder slug and use the file content for assistant config
  // // In a real implementation, we'd need to parse the YAML and extract the slug
  // const assistantSlug = "default/assistant";
  // try {
  //   sdkClient = await initializeContinueSDK(
  //     authConfig.accessToken,
  //     assistantSlug
  //   );
  //   // Since we're using a file, we need to manually set the assistant config
  //   assistant = JSON.parse(JSON.stringify(sdkClient.assistant.config));
  // } catch (error) {
  //   console.error(
  //     chalk.red("Error initializing SDK with local file:"),
  //     error
  //   );
  //   throw error;
  // }
  // }

  // Initialize ContinueSDK and MCPService once
  const { config, llmApi, model, mcpService } = await initializeAssistant(
    authConfig,
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
