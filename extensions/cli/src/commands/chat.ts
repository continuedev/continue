import { ModelConfig } from "@continuedev/config-yaml";
import chalk from "chalk";
import type { ChatHistoryItem, Session } from "core/index.js";
import { ChatDescriber } from "core/util/chatDescriber.js";
import * as readlineSync from "readline-sync";

import {
  compactChatHistory,
  findCompactionIndex,
  getHistoryForLLM,
} from "../compaction.js";
import { processCommandFlags } from "../flags/flagProcessor.js";
import { safeStdout } from "../init.js";
import { configureLogger } from "../logger.js";
import * as logging from "../logging.js";
import { sentryService } from "../sentry.js";
import { initializeServices } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import {
  loadSession,
  updateSessionHistory,
  updateSessionTitle,
} from "../session.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { posthogService } from "../telemetry/posthogService.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { startTUIChat } from "../ui/index.js";
import { formatAnthropicError, formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";
import {
  calculateContextUsagePercentage,
  countChatHistoryTokens,
  shouldAutoCompact,
} from "../util/tokenizer.js";

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
  } catch {
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
  let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, "");

  // Remove excess whitespace: multiple consecutive newlines become single newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");

  // Trim leading and trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

export interface ChatOptions extends ExtendedCommandOptions {
  headless?: boolean;
  resume?: boolean;
  format?: "json"; // Output format for headless mode
  silent?: boolean; // Strip <think></think> tags and excess whitespace
}

export async function initializeChatHistory(
  options: ChatOptions,
): Promise<ChatHistoryItem[]> {
  let session: Session | null = null;

  // Load previous session if --resume flag is used
  if (options.resume) {
    session = loadSession();
    if (session) {
      logger.info(chalk.yellow("Resuming previous session..."));
      return session.history;
    } else {
      logger.info(chalk.yellow("No previous session found, starting fresh..."));
    }
  }

  return [];
}

// Helper function to handle manual compaction
async function handleManualCompaction(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: any,
  isHeadless: boolean,
): Promise<{ compactionIndex?: number | null } | void> {
  if (!isHeadless) {
    console.info(chalk.yellow("Compacting chat history..."));
  }

  try {
    const result = await compactChatHistory(chatHistory, model, llmApi);

    // Replace chat history with compacted version
    chatHistory.length = 0;
    chatHistory.push(...result.compactedHistory);

    // Save the compacted session
    updateSessionHistory(chatHistory);

    if (isHeadless) {
      safeStdout(
        JSON.stringify({
          status: "success",
          message: "Chat history compacted",
          historyLength: chatHistory.length,
        }) + "\n",
      );
    } else {
      console.info(chalk.green("Chat history compacted successfully."));
    }

    return { compactionIndex: result.compactionIndex };
  } catch (error) {
    const errorMsg = `Compaction error: ${formatError(error)}`;
    if (isHeadless) {
      safeStdout(JSON.stringify({ status: "error", message: errorMsg }) + "\n");
    } else {
      console.error(chalk.red(errorMsg));
    }
    return;
  }
}

// Helper function to handle auto-compaction for headless mode
async function handleAutoCompaction(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: any,
  isHeadless: boolean,
  format?: "json",
): Promise<number | null> {
  const { handleAutoCompaction: coreAutoCompaction } = await import(
    "../stream/streamChatResponse.autoCompaction.js"
  );

  // Custom callbacks for headless mode console output
  const callbacks = {
    onSystemMessage: (message: string) => {
      if (
        message.includes("Auto-compacting") ||
        message.includes("Approaching")
      ) {
        if (!isHeadless) {
          console.info(chalk.yellow(`\n${message}`));
        } else if (format === "json") {
          safeStdout(
            JSON.stringify({
              status: "info",
              message: "Auto-compacting triggered",
              contextUsage:
                calculateContextUsagePercentage(
                  countChatHistoryTokens(chatHistory),
                  model,
                ) + "%",
            }) + "\n",
          );
        }
      } else if (message.includes("✓")) {
        if (!isHeadless) {
          console.info(chalk.green(message));
        } else if (format === "json") {
          safeStdout(
            JSON.stringify({
              status: "success",
              message: "Auto-compacted successfully",
              historyLength: chatHistory.length,
            }) + "\n",
          );
        }
      } else if (message.includes("Warning:")) {
        if (!isHeadless) {
          console.error(chalk.red(message));
          console.info(chalk.yellow("Continuing without compaction..."));
        } else if (format === "json") {
          safeStdout(
            JSON.stringify({
              status: "warning",
              message: "Auto-compaction failed, continuing without compaction",
            }) + "\n",
          );
        }
      }
    },
  };

  const result = await coreAutoCompaction(chatHistory, model, llmApi, {
    isHeadless,
    format,
    callbacks,
  });

  // Update the original array reference for headless mode
  chatHistory.length = 0;
  chatHistory.push(...result.chatHistory);

  return result.compactionIndex;
}

/**
 * Helper to generate and update session title after first assistant response
 */
async function handleTitleGeneration(
  assistantResponse: string,
  llmApi: any,
  model: ModelConfig,
): Promise<void> {
  try {
    if (!assistantResponse) return;

    const generatedTitle = await ChatDescriber.describeWithBaseLlmApi(
      llmApi,
      model,
      assistantResponse,
    );

    if (generatedTitle) {
      updateSessionTitle(generatedTitle);
      logger.debug("Generated session title:", generatedTitle);
    }
  } catch (error) {
    // Don't fail the response if title generation fails
    logger.debug("Session title generation failed:", error);
  }
}

interface ProcessMessageOptions {
  userInput: string;
  chatHistory: ChatHistoryItem[];
  model: ModelConfig;
  llmApi: any;
  isHeadless: boolean;
  format?: "json";
  silent?: boolean;
  compactionIndex?: number | null;
  firstAssistantResponse?: boolean;
}

async function processMessage(
  options: ProcessMessageOptions,
): Promise<{ compactionIndex?: number | null } | void> {
  const {
    userInput,
    chatHistory,
    model,
    llmApi,
    isHeadless,
    format,
    silent,
    compactionIndex: initialCompactionIndex,
    firstAssistantResponse = false,
  } = options;
  let compactionIndex = initialCompactionIndex;
  // Check for slash commands in headless mode
  if (userInput.trim() === "/compact") {
    return handleManualCompaction(chatHistory, model, llmApi, isHeadless);
  }

  // Track user prompt
  telemetryService.logUserPrompt(userInput.length, userInput);

  // Check if auto-compacting is needed BEFORE adding user message
  if (shouldAutoCompact(chatHistory, model)) {
    const newIndex = await handleAutoCompaction(
      chatHistory,
      model,
      llmApi,
      isHeadless,
      format,
    );
    if (newIndex !== null) {
      compactionIndex = newIndex;
      // Replace chatHistory with compacted version
      chatHistory.length = 0;
      chatHistory.push(...chatHistory);
    }
  }

  // Add user message to history AFTER potential compaction
  chatHistory.push({
    message: { role: "user", content: userInput },
    contextItems: [],
  });

  // Get AI response with potential tool usage
  if (!isHeadless) {
    console.info(`\n${chalk.bold.blue("Assistant:")}`);
  }

  try {
    const abortController = new AbortController();

    // Handle compaction properly - streamChatResponse modifies the array in place
    let finalResponse;
    if (compactionIndex !== null && compactionIndex !== undefined) {
      // When using compaction, we need to send a subset but capture the full history
      const historyForLLM = getHistoryForLLM(chatHistory, compactionIndex);
      const originalLength = historyForLLM.length;

      finalResponse = await streamChatResponse(
        historyForLLM,
        model,
        llmApi,
        abortController,
      );

      // Append any new messages (assistant/tool) that were added by streamChatResponse
      const newMessages = historyForLLM.slice(originalLength);
      chatHistory.push(...newMessages);
    } else {
      // No compaction - just pass the full history directly
      finalResponse = await streamChatResponse(
        chatHistory,
        model,
        llmApi,
        abortController,
      );
      // No need to sync back - streamChatResponse modifies chatHistory in place
    }

    // Generate session title after first assistant response
    if (firstAssistantResponse && finalResponse && finalResponse.trim()) {
      await handleTitleGeneration(finalResponse, llmApi, model);
    }

    // In headless mode, only print the final response using safe stdout
    if (isHeadless && finalResponse && finalResponse.trim()) {
      let processedResponse = finalResponse;

      // Strip think tags if --silent flag is enabled
      if (silent) {
        processedResponse = stripThinkTags(processedResponse);
      }

      // Process output based on format
      const outputResponse =
        format === "json"
          ? processJsonOutput(processedResponse)
          : processedResponse;

      safeStdout(outputResponse + "\n");
    }

    // Save session after each successful response
    updateSessionHistory(chatHistory);
  } catch (e: any) {
    const error = e instanceof Error ? e : new Error(String(e));

    if (model.provider === "anthropic") {
      logger.error(`\n${chalk.red(`Error: ${formatAnthropicError(error)}`)}`);
    } else {
      logger.error(`\n${chalk.red(`Error: ${formatError(error)}`)}`);
    }

    sentryService.captureException(error, {
      context: "chat_response",
      isHeadless,
      chatHistoryLength: chatHistory.length,
    });
    if (!isHeadless) {
      logger.info(
        chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`),
      );
    }
  }
}

async function runHeadlessMode(
  prompt: string | undefined,
  options: ChatOptions,
): Promise<void> {
  // Initialize services for headless mode
  const { permissionOverrides } = processCommandFlags(options);

  await initializeServices({
    options,
    headless: true,
    toolPermissionOverrides: permissionOverrides,
  });

  // Get required services from the service container
  const modelState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );
  const { llmApi, model } = modelState;

  if (!model) {
    throw new Error("No models were found.");
  }

  // Initialize chat history
  const chatHistory = await initializeChatHistory(options);

  // Track compaction index if resuming with compacted history
  let compactionIndex: number | null = null;
  if (options.resume) {
    compactionIndex = findCompactionIndex(chatHistory);
  }

  // Handle additional prompts from --prompt flags
  const { processAndCombinePrompts } = await import(
    "../util/promptProcessor.js"
  );
  const initialUserInput = await processAndCombinePrompts(
    options.prompt,
    prompt,
  );

  let isFirstMessage = true;
  while (true) {
    // When in headless mode, don't ask for user input
    if (!isFirstMessage && initialUserInput && options.headless) {
      break;
    }

    // Get user input
    const userInput =
      isFirstMessage && initialUserInput
        ? initialUserInput
        : readlineSync.question(`\n${chalk.bold.green("You:")} `);

    isFirstMessage = false;

    const result = await processMessage({
      userInput,
      chatHistory,
      model,
      llmApi,
      isHeadless: true,
      format: options.format,
      silent: options.silent,
      compactionIndex,
      firstAssistantResponse: isFirstMessage && !options.resume, // Only generate title for new conversations
    });

    // Update compaction index if compaction occurred
    if (result && result.compactionIndex !== undefined) {
      compactionIndex = result.compactionIndex;
    }
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

    // If not in headless mode, use unified initialization with TUI
    if (!options.headless) {
      // Process flags for TUI mode
      const { permissionOverrides } = processCommandFlags(options);

      // Initialize services with onboarding handled internally
      const initResult = await initializeServices({
        options,
        headless: false,
        toolPermissionOverrides: permissionOverrides,
      });

      // If onboarding was completed, show success message
      if (initResult.wasOnboarded) {
        console.log(chalk.green("✓ Setup complete! Starting chat..."));
      }

      // Start TUI with skipOnboarding since we already handled it
      const tuiOptions: any = {
        initialPrompt: prompt,
        resume: options.resume,
        config: options.config,
        org: options.org,
        rule: options.rule,
        prompt: options.prompt,
        toolPermissionOverrides: permissionOverrides,
        skipOnboarding: true,
      };

      // If we detected piped input, create a custom stdin for TUI
      if ((options as any).hasPipedInput) {
        const fs = await import("fs");
        const { ReadStream } = await import("tty");
        const ttyFd = fs.openSync("/dev/tty", "r");
        const customStdin = new ReadStream(ttyFd);
        tuiOptions.customStdin = customStdin;
        logger.debug("Created custom TTY stdin for TUI mode");
      }

      await startTUIChat(tuiOptions);
      return;
    }

    // Run headless mode
    await runHeadlessMode(prompt, options);
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Use headless-aware error logging to ensure fatal errors are shown in headless mode
    logging.error(chalk.red(`Fatal error: ${formatError(err)}`));
    sentryService.captureException(err, {
      context: "chat_command_fatal",
      headless: options.headless,
    });
    process.exit(1);
  } finally {
    // Stop active time tracking
    telemetryService.stopActiveTime();
  }
}
