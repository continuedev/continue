import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { ensureAuthenticated } from "../auth/ensureAuth.js";
import { ensureOrganization, loadAuthConfig } from "../auth/workos.js";
import { initializeAssistant } from "../config.js";
import { introMessage } from "../intro.js";
import { configureLogger } from "../logger.js";
import { loadSession, saveSession } from "../session.js";
import { streamChatResponse } from "../streamChatResponse.js";
import { constructSystemMessage } from "../systemMessage.js";
import { startTUIChat } from "../ui/index.js";

export interface ChatOptions {
  headless?: boolean;
  config?: string;
  resume?: boolean;
}

async function initializeChat(options: ChatOptions) {
  const isAuthenticated = await ensureAuthenticated(true);

  if (!isAuthenticated) {
    console.error(chalk.red("Authentication failed. Exiting..."));
    process.exit(1);
  }

  const authConfig = loadAuthConfig();

  // Ensure organization is selected
  const authConfigWithOrg = await ensureOrganization(
    authConfig,
    options.headless ?? false
  );

  // Initialize ContinueSDK and MCPService once
  const { config, llmApi, model, mcpService } = await initializeAssistant(
    authConfigWithOrg,
    options.config
  );

  return { config, llmApi, model, mcpService };
}

export async function chat(prompt?: string, options: ChatOptions = {}) {
  // Configure logger based on headless mode
  configureLogger(options.headless ?? false);

  try {
    let { config, llmApi, model, mcpService } = await initializeChat(options);

    // If not in headless mode, start the TUI chat (default)
    if (!options.headless) {
      await startTUIChat(
        config,
        llmApi,
        model,
        mcpService,
        prompt,
        options.resume,
        options.config
      );
      return;
    }

    // Show intro message for headless mode
    introMessage(config, model, mcpService);

    // Rules
    let chatHistory: ChatCompletionMessageParam[] = [];

    // Load previous session if --resume flag is used
    if (options.resume) {
      const savedHistory = loadSession();
      if (savedHistory) {
        chatHistory = savedHistory;
        console.log(chalk.yellow("Resuming previous session..."));
      } else {
        console.log(
          chalk.yellow("No previous session found, starting fresh...")
        );
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
      if (!isFirstMessage && prompt && options.headless) {
        break;
      }

      // Get user input
      let userInput =
        isFirstMessage && prompt
          ? prompt
          : readlineSync.question(`\n${chalk.bold.green("You:")} `);

      isFirstMessage = false;

      // Add user message to history
      chatHistory.push({ role: "user", content: userInput });

      // Get AI response with potential tool usage
      if (!options.headless) {
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
        if (options.headless && finalResponse.trim()) {
          console.log(finalResponse);
        }

        // Save session after each successful response
        saveSession(chatHistory);
      } catch (e: any) {
        console.error(`\n${chalk.red(`Error: ${e.message}`)}`);
        if (!options.headless) {
          console.info(
            chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`)
          );
        }
      }
    }
  } catch (error: any) {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  }
}
