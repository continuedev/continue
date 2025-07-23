import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "../asciiArt.js";
import { configureLogger } from "../logger.js";
import * as logging from "../logging.js";
import { initializeServices } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
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

async function initializeChatHistory(
  options: ChatOptions
): Promise<ChatCompletionMessageParam[]> {
  let chatHistory: ChatCompletionMessageParam[] = [];

  // Load previous session if --resume flag is used
  if (options.resume) {
    const savedHistory = loadSession();
    if (savedHistory) {
      chatHistory = savedHistory;
      logger.info(chalk.yellow("Resuming previous session..."));
    } else {
      logger.info(chalk.yellow("No previous session found, starting fresh..."));
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

  return chatHistory;
}

async function processMessage(
  userInput: string,
  chatHistory: ChatCompletionMessageParam[],
  model: any,
  llmApi: any,
  isHeadless: boolean
): Promise<void> {
  // Track user prompt
  telemetryService.logUserPrompt(userInput.length, userInput);

  // Add user message to history
  chatHistory.push({ role: "user", content: userInput });

  // Get AI response with potential tool usage
  if (!isHeadless) {
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
    if (isHeadless && finalResponse.trim()) {
      safeStdout(finalResponse + "\n");
    }

    // Save session after each successful response
    saveSession(chatHistory);
  } catch (e: any) {
    logger.error(`\n${chalk.red(`Error: ${formatError(e)}`)}`);
    if (!isHeadless) {
      logger.info(
        chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`)
      );
    }
  }
}

async function runHeadlessMode(
  prompt: string | undefined,
  options: ChatOptions
): Promise<void> {
  // Initialize services for headless mode
  await initializeServices({
    configPath: options.config,
    rules: options.rule,
    headless: true,
  });

  // Get required services from the service container
  const modelState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL
  );
  const { llmApi, model } = modelState;

  // Initialize chat history
  const chatHistory = await initializeChatHistory(options);

  let isFirstMessage = true;
  while (true) {
    // When in headless mode, don't ask for user input
    if (!isFirstMessage && prompt && options.headless) {
      break;
    }

    // Get user input
    const userInput =
      isFirstMessage && prompt
        ? prompt
        : readlineSync.question(`\n${chalk.bold.green("You:")} `);

    isFirstMessage = false;

    await processMessage(userInput, chatHistory, model, llmApi, true);
  }
}

export async function chat(prompt?: string, options: ChatOptions = {}) {
  // Configure logger based on headless mode
  configureLogger(options.headless ?? false);

  // Configure headless-aware logging system
  logging.configureLogger({ headless: options.headless ?? false });

  try {
    // Record session start
    telemetryService.recordSessionStart();

    // Start active time tracking
    telemetryService.startActiveTime();

    // If not in headless mode, start the TUI chat (default)
    if (!options.headless) {
      // Show ASCII art and version for TUI mode
      console.log(chalk.white(CONTINUE_ASCII_ART));
      console.info(
        chalk.gray(
          `${" ".repeat(
            CONTINUE_ASCII_ART.trimEnd().split("\n").pop()!.length
          )}v${getVersion()}\n`
        )
      );

      // Start TUI immediately - it will handle service loading
      await startTUIChat(prompt, options.resume, options.config, options.rule);
      return;
    }

    // Run headless mode
    await runHeadlessMode(prompt, options);
  } catch (error: any) {
    // Use headless-aware error logging to ensure fatal errors are shown in headless mode
    logging.error(chalk.red(`Fatal error: ${formatError(error)}`));
    process.exit(1);
  } finally {
    // Stop active time tracking
    telemetryService.stopActiveTime();
  }
}
