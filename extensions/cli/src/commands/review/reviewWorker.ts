/**
 * Review worker - runs in a forked process.
 *
 * Receives configuration via IPC, initializes services,
 * runs the agent in the worktree, then captures the diff
 * and sends results back via IPC.
 */

import * as fs from "fs";

import {
  initializeServices,
  getService,
  services,
  SERVICE_NAMES,
} from "../../services/index.js";
import type { ModelServiceState } from "../../services/types.js";
import { streamChatResponse } from "../../stream/streamChatResponse.js";

import type { DiffContext } from "./diffContext.js";
import { captureWorktreeDiff } from "./worktree.js";

export interface WorkerConfig {
  /** Hub slug or local file path for the agent */
  agentSource: string;
  /** Path to the worktree */
  worktreePath: string;
  /** Diff context for the prompt */
  diffContext: DiffContext;
  /** CLI options passed through */
  options: {
    config?: string;
    org?: string;
    rule?: string[];
    verbose?: boolean;
  };
}

export interface WorkerResult {
  patch: string;
  agentOutput: string;
  duration: number;
  error?: string;
}

/**
 * Build the review prompt that gets prepended to the agent's own instructions.
 */
function buildReviewPrompt(diffContext: DiffContext): string {
  const fileList = diffContext.changedFiles.map((f) => `- ${f}`).join("\n");

  let prompt = `You are a code review agent. Your job is to review ONLY the changed lines in the diff below and check them against your review rules.

## Scope — READ THIS CAREFULLY
- You MUST only review the files and lines shown in the diff.
- Do NOT read, scan, or report on files outside the diff.
- Do NOT report pre-existing issues in unchanged code — even in files that appear in the diff, only the changed lines are in scope.
- If you need surrounding context to understand a change, you may read that file, but you must NOT flag issues in the unchanged parts.

## Changes (base: ${diffContext.baseBranch})
### Changed files
${fileList || "(no files changed)"}

### Diff
\`\`\`diff
${diffContext.diff || "(no diff available)"}
\`\`\`
`;

  if (diffContext.truncated) {
    prompt += `\nNote: The diff was truncated due to size. You may use Read tool to view the full content of the changed files listed above — but do NOT explore beyond them.\n`;
  }

  prompt += `
## Rules
- You are in a temporary worktree. Dependencies (node_modules, etc.) are not installed.
- ONLY flag issues that exist in the changed lines of the diff.
- ONLY make edits to files listed in the changed files above, and only to fix violations of your specific review rules in the changed code.
- Do NOT make general improvements, refactoring, documentation changes, or style fixes.
- If there are no violations in the changed code, do NOT edit any files. State that no issues were found and exit.
`;

  return prompt;
}

/**
 * Load the agent's instructions from a local markdown file.
 */
function loadLocalAgentInstructions(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Entry point for the forked worker process.
 * Listens for IPC messages from the orchestrator.
 */
export async function runReviewWorker(): Promise<void> {
  if (typeof process.send !== "function") {
    console.error(
      "Error: review worker must be run as a forked process (via cn review).",
    );
    process.exit(1);
  }

  process.on("message", async (msg: { type: string; config: WorkerConfig }) => {
    if (msg.type !== "run-review") return;

    const { config } = msg;
    const startTime = Date.now();

    try {
      // Change working directory to the worktree
      process.chdir(config.worktreePath);

      // Initialize services in auto mode (full tool access)
      await initializeServices({
        options: {
          config: config.options.config,
          org: config.options.org,
          rule: config.options.rule,
        },
        headless: true,
        toolPermissionOverrides: {
          mode: "auto",
        },
      });

      // Get model service
      const modelState = await getService<ModelServiceState>(
        SERVICE_NAMES.MODEL,
      );

      if (!modelState.model || !modelState.llmApi) {
        throw new Error("Failed to initialize model service");
      }

      // Build the review prompt
      const reviewPrompt = buildReviewPrompt(config.diffContext);

      // Load agent-specific instructions if it's a local file
      let agentInstructions = "";
      if (
        config.agentSource.endsWith(".md") &&
        fs.existsSync(config.agentSource)
      ) {
        agentInstructions = loadLocalAgentInstructions(config.agentSource);
      }

      // Build the user prompt parts and add to ChatHistoryService
      // so streamChatResponse picks them up via refreshChatHistoryFromService
      const chatHistorySvc = services.chatHistory;

      const promptParts: string[] = [];
      if (agentInstructions) {
        promptParts.push(`## Agent Instructions\n\n${agentInstructions}`);
      }
      promptParts.push(reviewPrompt);

      const userMessage = promptParts.join("\n\n");
      chatHistorySvc.addUserMessage(userMessage);

      const chatHistory = chatHistorySvc.getHistory();

      // Collect agent text output
      let agentOutput = "";

      // Run the agent
      const abortController = new AbortController();
      const response = await streamChatResponse(
        chatHistory,
        modelState.model,
        modelState.llmApi,
        abortController,
      );

      agentOutput = response || "";

      // Capture the diff of changes the agent made
      const patch = captureWorktreeDiff(config.worktreePath);

      const result: WorkerResult = {
        patch,
        agentOutput,
        duration: (Date.now() - startTime) / 1000,
      };

      process.send!({ type: "result", result });
    } catch (e: any) {
      const result: WorkerResult = {
        patch: "",
        agentOutput: "",
        duration: (Date.now() - startTime) / 1000,
        error: e.message || String(e),
      };

      process.send!({ type: "result", result });
    }
  });

  // Signal ready
  process.send!({ type: "ready" });
}
