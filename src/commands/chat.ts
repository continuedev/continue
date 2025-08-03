import chalk from "chalk";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "../asciiArt.js";
import { loadAuthConfig } from "../auth/workos.js";
import { configureLogger } from "../logger.js";
import * as logging from "../logging.js";
import { initializeWithOnboarding } from "../onboarding.js";
import { initializeServices } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import { loadSession, saveSession } from "../session.js";
import { streamChatResponse } from "../streamChatResponse.js";
import { constructSystemMessage } from "../systemMessage.js";
import { posthogService } from "../telemetry/posthogService.js";
import telemetryService from "../telemetry/telemetryService.js";
import { startTUIChat } from "../ui/index.js";
import { safeStdout } from "../util/consoleOverride.js";
import { formatError } from "../util/formatError.js";
import logger from "../util/logger.js";
import { processCommandFlags } from "../flags/flagProcessor.js";
import { ExtendedCommandOptions } from "./BaseCommandOptions.js";

/**
 * Processes and validates JSON output for headless mode
 * @param response - The raw response from the LLM
 * @returns Valid JSON string
 */
function processJsonOutput(response: string): string {
  const trimmedResponse = response.trim();

  try {
    // Try to parse the response as JSON to validate it
    JSON.parse(trimmedResponse);
    // If it parses successfully, return as-is
    return trimmedResponse;
  } catch (error) {
    // If it's not valid JSON, wrap it in a JSON object
    return JSON.stringify({
      response: trimmedResponse,
      status: "success",
      note: "Response was not valid JSON, so it was wrapped in a JSON object",
    });
  }
}

/**
 * Strips <think></think> tags and excess whitespace from response
 * @param response - The raw response from the LLM
 * @returns Cleaned response
 */
function stripThinkTags(response: string): string {
  // Remove <think></think> tags and their content
  let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '');
  
  // Remove excess whitespace: multiple consecutive newlines become single newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Trim leading and trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

export interface ChatOptions extends ExtendedCommandOptions {
  headless?: boolean;
  resume?: boolean;
  rule?: string[]; // Array of rule specifications
  format?: "json"; // Output format for headless mode
  silent?: boolean; // Strip <think></think> tags and excess whitespace
}

export async function initializeChatHistory(
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
      options.rule,
      options.format,
      options.headless
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
  isHeadless: boolean,
  format?: "json",
  silent?: boolean
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
    if (isHeadless && finalResponse && finalResponse.trim()) {
      let processedResponse = finalResponse;
      
      // Strip think tags if --silent flag is enabled
      if (silent) {
        processedResponse = stripThinkTags(processedResponse);
      }
      
      // Process output based on format
      const outputResponse =
        format === "json" ? processJsonOutput(processedResponse) : processedResponse;

      safeStdout(outputResponse + "\n");
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
  const { permissionOverrides } = processCommandFlags(options);

  await initializeServices({
    configPath: options.config,
    rules: options.rule,
    headless: true,
    toolPermissionOverrides: permissionOverrides,
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

    await processMessage(
      userInput,
      chatHistory,
      model,
      llmApi,
      true,
      options.format,
      options.silent
    );
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
    await posthogService.capture("sessionStart", {});

    // Start active time tracking
    telemetryService.startActiveTime();

    // If not in headless mode, check for onboarding first
    if (!options.headless) {
      // Load auth config to check for onboarding
      const authConfig = loadAuthConfig();

      // Run onboarding check - this will handle first-time setup
      const onboardingResult = await initializeWithOnboarding(
        authConfig,
        options.config,
        options.rule
      );

      // If onboarding was completed (user just went through setup), show success message
      if (onboardingResult.wasOnboarded) {
        console.log(chalk.green("✓ Setup complete! Starting chat..."));
      }

      // Show ASCII art and version for TUI mode
      console.log(CONTINUE_ASCII_ART);

      // Process flags for TUI mode
      const { permissionOverrides } = processCommandFlags(options);

      // Start TUI immediately - it will handle service loading
      await startTUIChat(prompt, options.resume, options.config, options.rule, permissionOverrides);
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
