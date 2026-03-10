/**
 * Convenience functions for firing hook events from integration points.
 *
 * These functions build the hook input with common fields and delegate
 * to the HookService. They are safe to call even if the HookService
 * is not yet initialized (they return no-op results).
 */

import { services } from "../services/index.js";
import { getCurrentSession } from "../session.js";

import type {
  HookEventResult,
  NotificationInput,
  PostToolUseFailureInput,
  PostToolUseInput,
  PreCompactInput,
  PreToolUseInput,
  SessionEndInput,
  SessionEndReason,
  SessionStartInput,
  SessionStartSource,
  StopInput,
  UserPromptSubmitInput,
} from "./types.js";

const NOOP_RESULT: HookEventResult = { blocked: false, results: [] };

function getCommonFields(): {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
} {
  try {
    const session = getCurrentSession();
    const permissionMode = services.toolPermissions?.isReady()
      ? services.toolPermissions.getState().currentMode
      : undefined;

    return {
      session_id: session.sessionId,
      transcript_path: "", // We don't have a transcript file like Claude Code
      cwd: process.cwd(),
      permission_mode: permissionMode,
    };
  } catch {
    return {
      session_id: "",
      transcript_path: "",
      cwd: process.cwd(),
    };
  }
}

function isHookServiceReady(): boolean {
  try {
    return services.hooks?.isReady() ?? false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tool events
// ---------------------------------------------------------------------------

export async function firePreToolUse(
  toolName: string,
  toolInput: unknown,
  toolUseId: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: PreToolUseInput = {
    ...getCommonFields(),
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
  };

  return services.hooks.fireEvent(input);
}

export async function firePostToolUse(
  toolName: string,
  toolInput: unknown,
  toolResponse: unknown,
  toolUseId: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: PostToolUseInput = {
    ...getCommonFields(),
    hook_event_name: "PostToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
    tool_use_id: toolUseId,
  };

  return services.hooks.fireEvent(input);
}

export async function firePostToolUseFailure(
  toolName: string,
  toolInput: unknown,
  toolUseId: string,
  error: string,
  isInterrupt?: boolean,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: PostToolUseFailureInput = {
    ...getCommonFields(),
    hook_event_name: "PostToolUseFailure",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
    error,
    is_interrupt: isInterrupt,
  };

  return services.hooks.fireEvent(input);
}

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------

export async function fireUserPromptSubmit(
  prompt: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: UserPromptSubmitInput = {
    ...getCommonFields(),
    hook_event_name: "UserPromptSubmit",
    prompt,
  };

  return services.hooks.fireEvent(input);
}

export async function fireSessionStart(
  source: SessionStartSource,
  model?: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: SessionStartInput = {
    ...getCommonFields(),
    hook_event_name: "SessionStart",
    source,
    model,
  };

  return services.hooks.fireEvent(input);
}

export async function fireSessionEnd(
  reason: SessionEndReason,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: SessionEndInput = {
    ...getCommonFields(),
    hook_event_name: "SessionEnd",
    reason,
  };

  return services.hooks.fireEvent(input);
}

export async function fireStop(
  lastAssistantMessage?: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: StopInput = {
    ...getCommonFields(),
    hook_event_name: "Stop",
    stop_hook_active: true,
    last_assistant_message: lastAssistantMessage,
  };

  return services.hooks.fireEvent(input);
}

// ---------------------------------------------------------------------------
// Notification event
// ---------------------------------------------------------------------------

export async function fireNotification(
  message: string,
  notificationType: string,
  title?: string,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: NotificationInput = {
    ...getCommonFields(),
    hook_event_name: "Notification",
    message,
    title,
    notification_type: notificationType,
  };

  return services.hooks.fireEvent(input);
}

// ---------------------------------------------------------------------------
// Compaction event
// ---------------------------------------------------------------------------

export async function firePreCompact(
  trigger: "manual" | "auto",
  customInstructions: string | null = null,
): Promise<HookEventResult> {
  if (!isHookServiceReady()) return NOOP_RESULT;

  const input: PreCompactInput = {
    ...getCommonFields(),
    hook_event_name: "PreCompact",
    trigger,
    custom_instructions: customInstructions,
  };

  return services.hooks.fireEvent(input);
}
