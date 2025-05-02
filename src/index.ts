#!/usr/bin/env node

import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { parseArgs } from "./args.js";
import { ensureAuthenticated } from "./auth/ensureAuth.js";
import { loadAuthConfig } from "./auth/workos.js";
import { initializeContinueSDK } from "./continueSDK.js";
import { introMessage } from "./intro.js";
import { MCPService } from "./mcp.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";
import * as fs from "fs";
import { ContinueClient } from "@continuedev/sdk";

// Parse command line arguments
const args = parseArgs();

async function chat() {
  const isAuthenticated = await ensureAuthenticated(true);

  if (!isAuthenticated) {
    console.error(chalk.red("Authentication failed. Exiting..."));
    process.exit(1);
  }

  const authConfig = loadAuthConfig();

  // Check if the assistant path is a file or a slug
  let assistant: ContinueClient["assistant"];
  let client: ContinueClient["client"];

  if (fs.existsSync(args.assistantPath)) {
    // // If it's a file, load it directly
    // console.log(
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
  } else {
    // If it's not a file, assume it's a slug
    // console.log(
    //   chalk.yellow(`Loading assistant using slug: ${args.assistantPath}`)
    // );
    try {
      let continueSdk = await initializeContinueSDK(
        authConfig.accessToken,
        args.assistantPath
      );

      assistant = continueSdk.assistant;
      client = continueSdk.client;
    } catch (error) {
      console.error(
        chalk.red(`Error loading assistant ${args.assistantPath}:`),
        error
      );
      throw error;
    }
  }

  const mcpService = await MCPService.create(assistant!.config);

  // Only show intro message if not in headless mode
  if (!args.isHeadless) {
    introMessage(assistant!, mcpService);
  }

  // Rules
  const chatHistory: ChatCompletionMessageParam[] = [];
  const systemMessage = assistant!.systemMessage;
  if (systemMessage) {
    chatHistory.push({ role: "system", content: systemMessage });
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
    const commandResult = handleSlashCommands(userInput, assistant!.config);
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
    if (!args.isHeadless) {
      console.log(`\n${chalk.bold.blue("Assistant:")}`);
    }

    try {
      await streamChatResponse(chatHistory, assistant!, client!);
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
