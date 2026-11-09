import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import type { ToolPolicy } from "@continuedev/terminal-security";
import type { ChatHistoryItem } from "core/index.js";
import {
  autoReviewToolCall,
  type AutoReviewDeps,
  type AutoReviewReply,
} from "core/tools/permissions/auto/handler.js";
import { buildReviewHistory } from "core/tools/permissions/auto/history.js";
import { AutoReviewSessions } from "core/tools/permissions/auto/state.js";
import {
  evaluateToolPolicyWithRules,
  type ToolPolicyResult,
} from "core/tools/permissions/evaluate.js";
import type { ToolPermissions as CoreToolPermissions } from "core/tools/permissions/rules.js";

import { createLlmApi } from "../config.js";
import { logger } from "../util/logger.js";

import type { PermissionPolicy } from "./types.js";

/**
 * The `toolPermissions` rules of config.yaml and the Auto reviewer, applied in
 * the CLI by the same engine the IDE uses (core/tools/permissions). The CLI has
 * its own tool names and its own `--allow/--ask/--exclude` policies; those run
 * first and keep deciding what they decide. This layer then adds, in this order:
 * deny rules, protected paths, ask rules, allow rules, and (only with
 * `--auto-review`) the reviewer model for what is left. See
 * extensions/cli/src/permissions/README.md.
 */

/** CLI tool name to the name and arguments the core engine understands. */
export function toCoreCall(
  name: string,
  args: Record<string, unknown>,
): { toolName: string; parsedArgs: Record<string, unknown> } | undefined {
  switch (name) {
    case "Bash":
      return { toolName: "run_terminal_command", parsedArgs: args };
    case "Read":
      return { toolName: "read_file", parsedArgs: args };
    case "Write":
      return { toolName: "create_new_file", parsedArgs: args };
    case "Edit":
      return {
        toolName: "edit_existing_file",
        parsedArgs: { filepath: args.file_path },
      };
    case "MultiEdit":
      return {
        toolName: "multi_edit",
        parsedArgs: { filepath: args.file_path },
      };
    case "List":
      return { toolName: "ls", parsedArgs: { dirPath: args.dirpath } };
    case "Fetch":
      return { toolName: "fetch_url_content", parsedArgs: args };
    case "Search":
      return { toolName: "grep_search", parsedArgs: { query: args.pattern } };
    default:
      // MCP and other tools have no core name here, so rules do not apply.
      return undefined;
  }
}

function toToolPolicy(p: PermissionPolicy): ToolPolicy {
  return p === "allow"
    ? "allowedWithoutPermission"
    : p === "ask"
      ? "allowedWithPermission"
      : "disabled";
}

/** `--auto-review`, set once at startup. */
let autoReviewFlag = false;
export function setAutoReviewEnabled(enabled: boolean): void {
  autoReviewFlag = enabled;
}
export function isAutoReviewEnabled(): boolean {
  return autoReviewFlag;
}

const sessions = new AutoReviewSessions();
const SESSION_ID = "cli";

type ChatLike = NonNullable<AutoReviewDeps["reviewer"]>;

/**
 * The reviewer model, wrapped so core's reviewer can call it: the one
 * `modeModels.reviewer` names (any model), else the first with the `reviewer`
 * role. `modeModels.reviewer.reasoningEffort` is not applied in the CLI; a
 * catalog variant (`Name#variant`) sets the effort there.
 */
export function reviewerModel(
  assistant: AssistantUnrolled | null | undefined,
): ModelConfig | undefined {
  const named = (
    assistant as { modeModels?: { reviewer?: { model?: string } } }
  )?.modeModels?.reviewer?.model;
  const models = (assistant?.models ?? []).filter((m): m is ModelConfig => !!m);
  if (named) {
    const byName = models.find((m) => (m.name ?? m.model) === named);
    if (byName) return byName;
  }
  return models.find((m) => m.roles?.includes("reviewer" as never));
}

export function createReviewer(
  assistant: AssistantUnrolled | null | undefined,
  authConfig: Parameters<typeof createLlmApi>[1],
): ChatLike | null {
  const model = reviewerModel(assistant);
  if (!model) return null;
  const api = createLlmApi(model, authConfig);
  if (!api) return null;
  return {
    chat: async (
      messages: unknown[],
      signal?: AbortSignal,
      options?: { temperature?: number; maxTokens?: number },
    ) => {
      const res = await api.chatCompletionNonStream(
        {
          model: model.model,
          messages: messages as never,
          temperature: options?.temperature ?? 0,
          max_tokens: options?.maxTokens ?? 300,
          stream: false,
        },
        signal ?? new AbortController().signal,
      );
      return {
        role: "assistant",
        content: res.choices?.[0]?.message?.content ?? "",
      };
    },
  } as ChatLike;
}

let cachedReviewer:
  { assistant: unknown; reviewer: ChatLike | null } | undefined;

/** One reviewer per loaded assistant, so a client is not built for every call. */
export function getReviewer(
  assistant: AssistantUnrolled | null | undefined,
  authConfig: Parameters<typeof createLlmApi>[1],
): ChatLike | null {
  if (cachedReviewer && cachedReviewer.assistant === assistant) {
    return cachedReviewer.reviewer;
  }
  const reviewer = createReviewer(assistant, authConfig);
  cachedReviewer = { assistant, reviewer };
  return reviewer;
}

export interface CoreVerdict {
  /** allow runs it; ask needs a person (a refusal when headless); deny refuses. */
  decision: "allow" | "ask" | "deny";
  reason?: string;
  /** Who decided: the rules, the reviewer model, or Auto itself. */
  by: "rules" | "reviewer" | "system";
}

export interface CoreRulesInput {
  cliToolName: string;
  args: Record<string, unknown>;
  /** What the CLI's own policies decided for this call. */
  cliPermission: PermissionPolicy;
  /** The CLI tool's own check (command safety floor, and so on). */
  evaluateToolCallPolicy?: (
    base: ToolPolicy,
    args: Record<string, unknown>,
  ) => ToolPolicy;
  assistantPermissions: CoreToolPermissions | undefined;
  reviewer?: ChatLike | null;
  autoReview?: boolean;
  isHeadless: boolean;
  history?: ChatHistoryItem[];
  cwd?: string;
}

/**
 * Run the core engine for one CLI call. Returns undefined when the layer does
 * not apply (no rules and no reviewer, or a tool core has no name for), so the
 * caller keeps the CLI's own result.
 */
export async function evaluateWithCoreRules(
  input: CoreRulesInput,
): Promise<CoreVerdict | undefined> {
  const {
    cliToolName,
    args,
    cliPermission,
    assistantPermissions: permissions,
    isHeadless,
  } = input;
  const useReviewer = !!input.autoReview;
  if (!permissions && !useReviewer) return undefined;
  const call = toCoreCall(cliToolName, args);
  if (!call) return undefined;

  const tool = {
    group: "Built-In",
    evaluateToolCallPolicy: input.evaluateToolCallPolicy as never,
  };
  const basePolicy = toToolPolicy(cliPermission);

  if (useReviewer) {
    const reply: AutoReviewReply = await autoReviewToolCall(
      {
        tool,
        permissions,
        enabled: true,
        reviewer: input.reviewer ?? null,
        environment: {
          workspaceDirs: [input.cwd ?? process.cwd()],
          os: process.platform,
        },
        sessions,
      },
      {
        sessionId: SESSION_ID,
        toolName: call.toolName,
        basePolicy,
        parsedArgs: call.parsedArgs,
        history: buildReviewHistory(input.history ?? []),
        headless: isHeadless,
      },
    );
    logger.debug("Auto reviewer decision", {
      tool: cliToolName,
      decision: reply.decision,
      by: reply.by,
      category: reply.category,
    });
    return { decision: reply.decision, reason: reply.reason, by: reply.by };
  }

  const result: ToolPolicyResult = evaluateToolPolicyWithRules({
    tool: tool as never,
    toolName: call.toolName,
    basePolicy,
    parsedArgs: call.parsedArgs,
    permissions,
  });
  return {
    decision:
      result.policy === "disabled"
        ? "deny"
        : result.policy === "allowedWithPermission"
          ? "ask"
          : "allow",
    reason: result.reason,
    by: "rules",
  };
}
