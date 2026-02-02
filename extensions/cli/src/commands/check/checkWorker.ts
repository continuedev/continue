/**
 * Check worker - runs in a forked process.
 *
 * Receives configuration via IPC, initializes services,
 * runs the agent in the worktree, then captures the diff
 * and sends results back via IPC.
 */

import * as fs from "fs";
import type { ChatHistoryItem } from "core/index.js";

import {
  initializeServices,
  getService,
  SERVICE_NAMES,
} from "../../services/index.js";
import type { ModelServiceState } from "../../services/types.js";
import { streamChatResponse } from "../../stream/streamChatResponse.js";
import { constructSystemMessage } from "../../systemMessage.js";

import type { DiffContext } from "./diffContext.js";
import type { CheckResult } from "./renderReport.js";
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
 * Build the check prompt that gets prepended to the agent's own instructions.
 */
function buildCheckPrompt(diffContext: DiffContext): string {
  const fileList = diffContext.changedFiles.map((f) => `- ${f}`).join("\n");

  let prompt = `You are running as a local code check. Review and fix the following changes.

## Changes (base: ${diffContext.baseBranch})
### Changed files
${fileList || "(no files changed)"}

### Diff
\`\`\`diff
${diffContext.diff || "(no diff available)"}
\`\`\`
`;

  if (diffContext.truncated) {
    prompt += `\nNote: The diff was truncated due to size. Use Read and Search tools to inspect the full files.\n`;
  }

  prompt += `
## Context
- You are in a temporary worktree. Dependencies (node_modules, etc.) are not installed.
- Focus on source code analysis and edits.
- Make any edits you think are needed to fix issues. Your changes will be captured as suggestions.
- If there are no issues, simply say so and exit.
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
export async function runCheckWorker(): Promise<void> {
  if (typeof process.send !== "function") {
    console.error(
      "Error: check worker must be run as a forked process (via cn check).",
    );
    process.exit(1);
  }

  process.on("message", async (msg: { type: string; config: WorkerConfig }) => {
    if (msg.type !== "run-check") return;

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

      // Build system message
      const systemMessage = await constructSystemMessage(
        "auto",
        config.options.rule,
        undefined,
        true, // headless
      );

      // Build the check prompt
      const checkPrompt = buildCheckPrompt(config.diffContext);

      // Load agent-specific instructions if it's a local file
      let agentInstructions = "";
      if (
        config.agentSource.endsWith(".md") &&
        fs.existsSync(config.agentSource)
      ) {
        agentInstructions = loadLocalAgentInstructions(config.agentSource);
      }

      // Construct initial chat history
      const chatHistory: ChatHistoryItem[] = [];

      if (systemMessage) {
        chatHistory.push({
          message: { role: "user", content: systemMessage },
          contextItems: [],
        });
      }

      if (agentInstructions) {
        chatHistory.push({
          message: {
            role: "user",
            content: `## Agent Instructions\n\n${agentInstructions}`,
          },
          contextItems: [],
        });
      }

      chatHistory.push({
        message: { role: "user", content: checkPrompt },
        contextItems: [],
      });

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
