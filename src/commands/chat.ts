import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "../asciiArt.js";
import {
  ensureOrganization,
  getOrganizationId,
  loadAuthConfig,
} from "../auth/workos.js";
import { introMessage } from "../intro.js";
import { configureLogger } from "../logger.js";
import { initializeWithOnboarding } from "../onboarding.js";
import { loadSession, saveSession } from "../session.js";
import { streamChatResponse } from "../streamChatResponse.js";
import { constructSystemMessage } from "../systemMessage.js";
import telemetryService from "../telemetry/telemetryService.js";
import { startTUIChat } from "../ui/index.js";
import { safeStdout } from "../util/consoleOverride.js";
import { formatError } from "../util/formatError.js";
import logger from "../util/logger.js";
import { getVersion } from "../version.js";

export interface ChatOptions {
  headless?: boolean;
  config?: string;
  resume?: boolean;
  rule?: string[]; // Array of rule specifications
}

async function initializeChat(options: ChatOptions) {
  const authConfig = loadAuthConfig();

  // Use onboarding flow for initialization
  if (!options.headless) {
    console.log(chalk.white(CONTINUE_ASCII_ART));
    console.info(chalk.gray(`v${getVersion()}\n`));
  }
  const result = await initializeWithOnboarding(
    authConfig,
    options.config,
    options.rule
  );

  // Ensure organization is selected if authenticated
  let finalAuthConfig = authConfig;
  if (result.config && authConfig) {
    finalAuthConfig = await ensureOrganization(
      authConfig,
      options.headless ?? false
    );

    // Update telemetry with organization info
    if (finalAuthConfig) {
      const organizationId = getOrganizationId(finalAuthConfig);
      if (organizationId) {
        telemetryService.updateOrganization(organizationId);
      }
    }
  }

  return {
    config: result.config,
    llmApi: result.llmApi,
    model: result.model,
    mcpService: result.mcpService,
    apiClient: result.apiClient,
  };
}

export async function chat(prompt?: string, options: ChatOptions = {}) {
  // Configure logger based on headless mode
  configureLogger(options.headless ?? false);

  try {
    let { config, llmApi, model, mcpService, apiClient } = await initializeChat(
      options
    );

    // Record session start
    telemetryService.recordSessionStart();

    // Start active time tracking
    telemetryService.startActiveTime();

    // If not in headless mode, start the TUI chat (default)
    if (!options.headless) {
      await startTUIChat(
        config,
        llmApi,
        model,
        mcpService,
        apiClient,
        prompt,
        options.resume,
        options.config,
        options.rule
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
        logger.info(chalk.yellow("Resuming previous session..."));
      } else {
        logger.info(
          chalk.yellow("No previous session found, starting fresh...")
        );
      }
    }

    // If no session loaded or not resuming, initialize with system message
    if (chatHistory.length === 0) {
      const rulesSystemMessage = ""; // TODO //assistant.systemMessage;
      const systemMessage = await constructSystemMessage(
        rulesSystemMessage,
        options.rule
      );
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

      // Track user prompt
      telemetryService.logUserPrompt(userInput.length, userInput);

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

        // In headless mode, only print the final response using safe stdout
        if (options.headless) {
          if (finalResponse.trim()) {
            safeStdout(finalResponse + "\n");
          }
        }

        // Save session after each successful response
        saveSession(chatHistory);
      } catch (e: any) {
        logger.error(`\n${chalk.red(`Error: ${formatError(e)}`)}`);
        if (!options.headless) {
          logger.info(
            chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`)
          );
        }
      }
    }
  } catch (error: any) {
    logger.error(chalk.red(`Fatal error: ${formatError(error)}`));
    process.exit(1);
  } finally {
    // Stop active time tracking
    telemetryService.stopActiveTime();
  }
}
