import { exec, spawn } from "child_process";

import { PreprocessedToolCall } from "src/tools/types.js";

import { getCurrentSession, getSessionFilePath } from "../session.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import type { ModelServiceState } from "./types.js";

interface GitAiHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  model?: string;
  hook_event_name: "PreToolUse" | "PostToolUse";
  tool_input: {
    file_path: string;
  };
}

export interface GitAiIntegrationServiceState {
  isEnabled: boolean;
  isGitAiAvailable: boolean | null; // null = not checked yet
}

export class GitAiIntegrationService extends BaseService<GitAiIntegrationServiceState> {
  constructor() {
    super("GitAiIntegrationService", {
      isEnabled: true,
      isGitAiAvailable: null,
    });
  }

  async doInitialize(): Promise<GitAiIntegrationServiceState> {
    // Check if git-ai is available on first initialization
    const isAvailable = await this.checkGitAiAvailable();
    return {
      isEnabled: true,
      isGitAiAvailable: isAvailable,
    };
  }

  private async checkGitAiAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        exec("git-ai --version", (error) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch {
        // Handle edge case where exec throws synchronously
        resolve(false);
      }
    });
  }

  /**
   * Helper function to call git-ai checkpoint with the given hook input
   */
  private async callGitAiCheckpoint(
    hookInput: GitAiHookInput,
    workspaceDirectory: string,
  ): Promise<void> {
    const hookInputJson = JSON.stringify(hookInput);

    logger.debug("Calling git-ai checkpoint", {
      hookInput,
      workspaceDirectory,
    });

    await new Promise<void>((resolve, reject) => {
      const gitAiProcess = spawn(
        "git-ai",
        ["checkpoint", "continue-cli", "--hook-input", "stdin"],
        { cwd: workspaceDirectory },
      );

      let stdout = "";
      let stderr = "";

      gitAiProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitAiProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitAiProcess.on("error", (error: Error) => {
        reject(error);
      });

      gitAiProcess.on("close", (code: number | null) => {
        if (code === 0) {
          logger.debug("git-ai checkpoint completed", { stdout, stderr });
          resolve();
        } else {
          reject(
            new Error(`git-ai checkpoint exited with code ${code}: ${stderr}`),
          );
        }
      });

      // Write JSON to stdin and close
      gitAiProcess.stdin?.write(hookInputJson);
      gitAiProcess.stdin?.end();
    });
  }

  async trackToolUse(
    toolCall: PreprocessedToolCall,
    hookEventName: "PreToolUse" | "PostToolUse",
  ): Promise<void> {
    try {
      if (!this.currentState.isEnabled) {
        return;
      }
      const isFileEdit = ["Edit", "MultiEdit", "Write"].includes(toolCall.name);
      if (!isFileEdit) {
        return;
      }

      const filePath = this.extractFilePathFromToolCall(toolCall);
      if (filePath) {
        if (hookEventName === "PreToolUse") {
          await this.beforeFileEdit(filePath);
        } else if (hookEventName === "PostToolUse") {
          await this.afterFileEdit(filePath);
        }
      }
    } catch (error) {
      logger.warn("git-ai tool use tracking failed", {
        error,
        toolCall,
        hookEventName,
      });
      // Don't throw - allow tool use to proceed without Git AI checkpoint
    }
  }

  async beforeFileEdit(filePath: string): Promise<void> {
    if (!this.currentState.isEnabled) {
      return;
    }

    // Skip if git-ai is not available
    if (this.currentState.isGitAiAvailable === false) {
      return;
    }

    try {
      const session = getCurrentSession();
      const sessionFilePath = getSessionFilePath();

      // Get current model from ModelService via serviceContainer
      const modelState = serviceContainer.getSync<ModelServiceState>("model");
      const modelName = modelState?.value?.model?.model;

      const hookInput: GitAiHookInput = {
        session_id: session.sessionId,
        transcript_path: sessionFilePath,
        cwd: session.workspaceDirectory,
        hook_event_name: "PreToolUse",
        tool_input: {
          file_path: filePath,
        },
      };

      // Only include model if it's available
      if (modelName) {
        hookInput.model = modelName;
      }

      await this.callGitAiCheckpoint(hookInput, session.workspaceDirectory);
    } catch (error) {
      logger.warn("git-ai checkpoint (pre-edit) failed", { error, filePath });
      // Mark as unavailable if command fails
      this.setState({ isGitAiAvailable: false });
      // Don't throw - allow file edit to proceed
    }
  }

  async afterFileEdit(filePath: string): Promise<void> {
    if (!this.currentState.isEnabled) {
      return;
    }

    // Skip if git-ai is not available
    if (this.currentState.isGitAiAvailable === false) {
      return;
    }

    try {
      const session = getCurrentSession();
      const sessionFilePath = getSessionFilePath();

      // Get current model from ModelService via serviceContainer
      const modelState = serviceContainer.getSync<ModelServiceState>("model");
      const modelName = modelState?.value?.model?.model;

      const hookInput: GitAiHookInput = {
        session_id: session.sessionId,
        transcript_path: sessionFilePath,
        cwd: session.workspaceDirectory,
        hook_event_name: "PostToolUse",
        tool_input: {
          file_path: filePath,
        },
      };

      // Only include model if it's available
      if (modelName) {
        hookInput.model = modelName;
      }

      await this.callGitAiCheckpoint(hookInput, session.workspaceDirectory);
    } catch (error) {
      logger.warn("git-ai checkpoint (post-edit) failed", { error, filePath });
      // Mark as unavailable if command fails
      this.setState({ isGitAiAvailable: false });
      // Don't throw - file edit already completed
    }
  }

  setEnabled(enabled: boolean): void {
    this.setState({ isEnabled: enabled });
  }

  extractFilePathFromToolCall(toolCall: PreprocessedToolCall): string | null {
    const preprocessed = toolCall.preprocessResult;
    if (!preprocessed?.args) return null;

    const args = preprocessed.args;

    // Extract file path based on tool type
    if (toolCall.name === "Edit" && args.resolvedPath) {
      return args.resolvedPath;
    } else if (toolCall.name === "MultiEdit" && args.file_path) {
      return args.file_path;
    } else if (toolCall.name === "Write" && args.filepath) {
      return args.filepath;
    }

    return null;
  }
}
