/**
 * Claude Code-compatible hooks system for Continue CLI.
 *
 * These types match the exact schemas from Claude Code so that any hook
 * written for `claude` works with `cn` out of the box.
 */

// ---------------------------------------------------------------------------
// Hook event names
// ---------------------------------------------------------------------------

export const HOOK_EVENT_NAMES = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionRequest",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "ConfigChange",
  "TeammateIdle",
  "TaskCompleted",
  "WorktreeCreate",
  "WorktreeRemove",
] as const;

export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

// ---------------------------------------------------------------------------
// Hook handler configuration (what users write in settings.json)
// ---------------------------------------------------------------------------

/** Common fields shared by all hook handler types */
interface HookHandlerBase {
  /** Seconds before canceling. Defaults: 600 for command, 30 for http/prompt, 60 for agent */
  timeout?: number;
  /** Custom spinner message displayed while the hook runs */
  statusMessage?: string;
  /** If true, runs only once per session then is removed (skills only) */
  once?: boolean;
}

/** Command hook handler — runs a shell command */
export interface CommandHookHandler extends HookHandlerBase {
  type: "command";
  /** Shell command to execute */
  command: string;
  /** If true, runs in the background without blocking */
  async?: boolean;
}

/** HTTP hook handler — sends a POST request */
export interface HttpHookHandler extends HookHandlerBase {
  type: "http";
  /** URL to send the POST request to */
  url: string;
  /** Additional HTTP headers (values support env var interpolation) */
  headers?: Record<string, string>;
  /** Environment variable names allowed in header interpolation */
  allowedEnvVars?: string[];
}

/** Prompt hook handler — single-turn LLM evaluation */
export interface PromptHookHandler extends HookHandlerBase {
  type: "prompt";
  /** Prompt text. Use $ARGUMENTS as a placeholder for hook input JSON */
  prompt: string;
  /** Model to use. Defaults to a fast model */
  model?: string;
}

/** Agent hook handler — multi-turn subagent with tool access */
export interface AgentHookHandler extends HookHandlerBase {
  type: "agent";
  /** Prompt text. Use $ARGUMENTS as a placeholder for hook input JSON */
  prompt: string;
  /** Model to use. Defaults to a fast model */
  model?: string;
}

export type HookHandler =
  | CommandHookHandler
  | HttpHookHandler
  | PromptHookHandler
  | AgentHookHandler;

/** A matcher group: a regex filter + one or more handlers */
export interface HookMatcherGroup {
  /** Regex string to filter when hooks fire. "*", "", or omitted = match all */
  matcher?: string;
  /** The hook handlers to run when the matcher matches */
  hooks: HookHandler[];
}

/** Top-level hooks configuration object (the `hooks` key in settings.json) */
export type HooksConfig = Partial<Record<HookEventName, HookMatcherGroup[]>>;

/** Full settings file shape (only the hooks portion) */
export interface HookSettingsFile {
  hooks?: HooksConfig;
  /** Plugin-level description */
  description?: string;
  /** If true, all hooks are disabled */
  disableAllHooks?: boolean;
}

// ---------------------------------------------------------------------------
// Hook input — JSON sent to hooks on stdin / as POST body
// ---------------------------------------------------------------------------

/** Common fields included in every hook event input */
export interface HookInputBase {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
}

export interface PreToolUseInput extends HookInputBase {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
}

export interface PostToolUseInput extends HookInputBase {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
}

export interface PostToolUseFailureInput extends HookInputBase {
  hook_event_name: "PostToolUseFailure";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  error: string;
  is_interrupt?: boolean;
}

export interface PermissionRequestInput extends HookInputBase {
  hook_event_name: "PermissionRequest";
  tool_name: string;
  tool_input: unknown;
}

export interface UserPromptSubmitInput extends HookInputBase {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}

export type SessionStartSource = "startup" | "resume" | "clear" | "compact";

export interface SessionStartInput extends HookInputBase {
  hook_event_name: "SessionStart";
  source: SessionStartSource;
  agent_type?: string;
  model?: string;
}

export type SessionEndReason =
  | "clear"
  | "logout"
  | "prompt_input_exit"
  | "other"
  | "bypass_permissions_disabled";

export interface SessionEndInput extends HookInputBase {
  hook_event_name: "SessionEnd";
  reason: SessionEndReason;
}

export interface StopInput extends HookInputBase {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
  last_assistant_message?: string;
}

export interface NotificationInput extends HookInputBase {
  hook_event_name: "Notification";
  message: string;
  title?: string;
  notification_type: string;
}

export interface SubagentStartInput extends HookInputBase {
  hook_event_name: "SubagentStart";
  agent_id: string;
  agent_type: string;
}

export interface SubagentStopInput extends HookInputBase {
  hook_event_name: "SubagentStop";
  stop_hook_active: boolean;
  agent_id: string;
  agent_transcript_path: string;
  agent_type: string;
  last_assistant_message?: string;
}

export interface PreCompactInput extends HookInputBase {
  hook_event_name: "PreCompact";
  trigger: "manual" | "auto";
  custom_instructions: string | null;
}

export interface ConfigChangeInput extends HookInputBase {
  hook_event_name: "ConfigChange";
  source: string;
  file_path?: string;
}

export interface TeammateIdleInput extends HookInputBase {
  hook_event_name: "TeammateIdle";
  teammate_name: string;
  team_name: string;
}

export interface TaskCompletedInput extends HookInputBase {
  hook_event_name: "TaskCompleted";
  task_id: string;
  task_subject: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
}

export interface WorktreeCreateInput extends HookInputBase {
  hook_event_name: "WorktreeCreate";
  name: string;
}

export interface WorktreeRemoveInput extends HookInputBase {
  hook_event_name: "WorktreeRemove";
  worktree_path: string;
}

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | PostToolUseFailureInput
  | PermissionRequestInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SessionEndInput
  | StopInput
  | NotificationInput
  | SubagentStartInput
  | SubagentStopInput
  | PreCompactInput
  | ConfigChangeInput
  | TeammateIdleInput
  | TaskCompletedInput
  | WorktreeCreateInput
  | WorktreeRemoveInput;

// ---------------------------------------------------------------------------
// Hook output — JSON returned by hooks on stdout / response body
// ---------------------------------------------------------------------------

/** PreToolUse-specific output */
export interface PreToolUseHookOutput {
  hookEventName: "PreToolUse";
  permissionDecision?: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
}

/** UserPromptSubmit-specific output */
export interface UserPromptSubmitHookOutput {
  hookEventName: "UserPromptSubmit";
  additionalContext?: string;
}

/** SessionStart-specific output */
export interface SessionStartHookOutput {
  hookEventName: "SessionStart";
  additionalContext?: string;
}

/** PostToolUse-specific output */
export interface PostToolUseHookOutput {
  hookEventName: "PostToolUse";
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;
}

/** PostToolUseFailure-specific output */
export interface PostToolUseFailureHookOutput {
  hookEventName: "PostToolUseFailure";
  additionalContext?: string;
}

/** Notification-specific output */
export interface NotificationHookOutput {
  hookEventName: "Notification";
  additionalContext?: string;
}

/** SubagentStart-specific output */
export interface SubagentStartHookOutput {
  hookEventName: "SubagentStart";
  additionalContext?: string;
}

/** PermissionRequest-specific output */
export interface PermissionRequestHookOutput {
  hookEventName: "PermissionRequest";
  decision:
    | {
        behavior: "allow";
        updatedInput?: Record<string, unknown>;
      }
    | {
        behavior: "deny";
        message?: string;
        interrupt?: boolean;
      };
}

export type HookSpecificOutput =
  | PreToolUseHookOutput
  | UserPromptSubmitHookOutput
  | SessionStartHookOutput
  | PostToolUseHookOutput
  | PostToolUseFailureHookOutput
  | NotificationHookOutput
  | SubagentStartHookOutput
  | PermissionRequestHookOutput;

/** The full JSON output schema returned by hooks */
export interface HookOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: "approve" | "block";
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?: HookSpecificOutput;
}

// ---------------------------------------------------------------------------
// Hook execution result (internal)
// ---------------------------------------------------------------------------

export interface HookExecutionResult {
  /** The parsed output from the hook, if any */
  output: HookOutput | null;
  /** Raw stdout from the hook */
  stdout: string;
  /** Raw stderr from the hook */
  stderr: string;
  /** Exit code (command hooks only) */
  exitCode: number;
  /** Whether the hook blocked the action (exit code 2 or decision:"block") */
  blocked: boolean;
  /** The blocking error message (from stderr or output.reason) */
  blockReason?: string;
}

/**
 * Aggregated result from running all matching hooks for an event.
 * Used by integration points to decide what to do.
 */
export interface HookEventResult {
  /** Whether any hook blocked the action */
  blocked: boolean;
  /** The reason the action was blocked (first blocking hook's reason) */
  blockReason?: string;
  /** Additional context to inject (concatenated from all hooks) */
  additionalContext?: string;
  /** For PreToolUse: permission decision from hooks */
  permissionDecision?: "allow" | "deny" | "ask";
  /** For PreToolUse: reason for permission decision */
  permissionDecisionReason?: string;
  /** For PreToolUse: updated tool input */
  updatedInput?: Record<string, unknown>;
  /** For PermissionRequest: the decision */
  permissionRequestDecision?: PermissionRequestHookOutput["decision"];
  /** All individual hook results */
  results: HookExecutionResult[];
}

// ---------------------------------------------------------------------------
// Matcher field mapping
// ---------------------------------------------------------------------------

/**
 * Which field from the hook input the matcher regex runs against,
 * per event type. Events not listed here don't support matchers.
 */
export const MATCHER_FIELD_MAP: Partial<Record<HookEventName, string>> = {
  PreToolUse: "tool_name",
  PostToolUse: "tool_name",
  PostToolUseFailure: "tool_name",
  PermissionRequest: "tool_name",
  SessionStart: "source",
  SessionEnd: "reason",
  Notification: "notification_type",
  SubagentStart: "agent_type",
  SubagentStop: "agent_type",
  PreCompact: "trigger",
  ConfigChange: "source",
};

/**
 * Events that don't support matchers — they always fire on every occurrence.
 */
export const NO_MATCHER_EVENTS: HookEventName[] = [
  "UserPromptSubmit",
  "Stop",
  "TeammateIdle",
  "TaskCompleted",
  "WorktreeCreate",
  "WorktreeRemove",
];
