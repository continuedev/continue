import { execFile } from "child_process";

import { logger } from "../util/logger.js";

import { getMatchingHookGroups } from "./hookConfig.js";
import { MATCHER_FIELD_MAP, NO_MATCHER_EVENTS } from "./types.js";
import type {
  CommandHookHandler,
  HookEventName,
  HookEventResult,
  HookExecutionResult,
  HookHandler,
  HookInput,
  HookOutput,
  HttpHookHandler,
} from "./types.js";
import type { HooksConfig } from "./types.js";

const DEFAULT_COMMAND_TIMEOUT_SECONDS = 600;
const DEFAULT_HTTP_TIMEOUT_SECONDS = 30;

function tryParseJson(str: string): HookOutput | null {
  const trimmed = str.trim();
  if (!trimmed || !trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as HookOutput;
  } catch {
    return null;
  }
}

function executeCommandHook(
  handler: CommandHookHandler,
  input: HookInput,
  cwd: string,
): Promise<HookExecutionResult> {
  const timeoutMs = (handler.timeout ?? DEFAULT_COMMAND_TIMEOUT_SECONDS) * 1000;

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      CLAUDE_PROJECT_DIR: cwd,
      CONTINUE_PROJECT_DIR: cwd,
    };

    // Use shell to execute the command (matches Claude Code behavior)
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    const shellArgs =
      process.platform === "win32"
        ? ["/c", handler.command]
        : ["-c", handler.command];

    const child = execFile(shell, shellArgs, {
      cwd,
      env,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (data: string) => {
      stdout += data;
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (data: string) => {
      stderr += data;
    });

    // Send JSON input on stdin
    if (child.stdin) {
      child.stdin.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") {
          logger.warn(
            `Failed writing hook input to stdin: ${handler.command}`,
            error,
          );
        }
      });
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    }

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      const output = tryParseJson(stdout);

      // Determine if the hook blocked the action
      let blocked = false;
      let blockReason: string | undefined;

      if (exitCode === 2) {
        blocked = true;
        blockReason = stderr.trim() || "Blocked by hook";
      } else if (output?.decision === "block") {
        blocked = true;
        blockReason = output.reason || stderr.trim() || "Blocked by hook";
      }

      resolve({
        output,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        blocked,
        blockReason,
      });
    });

    child.on("error", (error) => {
      logger.warn(`Hook command failed: ${handler.command}`, error);
      resolve({
        output: null,
        stdout: "",
        stderr: error.message,
        exitCode: 1,
        blocked: false,
      });
    });
  });
}

function interpolateEnvVars(value: string, allowedVars: string[]): string {
  return value.replace(/\$\{(\w+)\}|\$(\w+)/g, (_, braced, bare) => {
    const varName = braced ?? bare;
    if (allowedVars.includes(varName)) {
      return process.env[varName] ?? "";
    }
    return "";
  });
}

async function executeHttpHook(
  handler: HttpHookHandler,
  input: HookInput,
): Promise<HookExecutionResult> {
  const timeoutMs = (handler.timeout ?? DEFAULT_HTTP_TIMEOUT_SECONDS) * 1000;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (handler.headers) {
      const allowedVars = handler.allowedEnvVars ?? [];
      for (const [key, value] of Object.entries(handler.headers)) {
        headers[key] = interpolateEnvVars(value, allowedVars);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(handler.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Non-2xx = non-blocking error (matches Claude Code behavior)
      logger.warn(`HTTP hook returned ${response.status}: ${handler.url}`);
      return {
        output: null,
        stdout: "",
        stderr: `HTTP ${response.status}`,
        exitCode: 1,
        blocked: false,
      };
    }

    const bodyText = await response.text();
    const output = tryParseJson(bodyText);

    let blocked = false;
    let blockReason: string | undefined;

    if (output?.decision === "block") {
      blocked = true;
      blockReason = output.reason || "Blocked by hook";
    }

    return {
      output,
      stdout: bodyText.trim(),
      stderr: "",
      exitCode: 0,
      blocked,
      blockReason,
    };
  } catch (error) {
    // Connection failures and timeouts = non-blocking errors
    logger.warn(`HTTP hook failed: ${handler.url}`, error);
    return {
      output: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      blocked: false,
    };
  }
}

async function executeHandler(
  handler: HookHandler,
  input: HookInput,
  cwd: string,
): Promise<HookExecutionResult> {
  switch (handler.type) {
    case "command":
      return executeCommandHook(handler, input, cwd);
    case "http":
      return executeHttpHook(handler, input);
    case "prompt":
    case "agent":
      // Prompt and agent hooks are not yet implemented
      logger.debug(
        `Hook type "${handler.type}" is not yet supported, skipping`,
      );
      return {
        output: null,
        stdout: "",
        stderr: "",
        exitCode: 0,
        blocked: false,
      };
    default:
      logger.warn(`Unknown hook handler type: ${(handler as any).type}`);
      return {
        output: null,
        stdout: "",
        stderr: "",
        exitCode: 0,
        blocked: false,
      };
  }
}

function getHandlerDedupeKey(handler: HookHandler): string {
  switch (handler.type) {
    case "command":
      return `command:${handler.command}`;
    case "http":
      return `http:${handler.url}`;
    case "prompt":
      return `prompt:${handler.prompt}`;
    case "agent":
      return `agent:${handler.prompt}`;
    default:
      return `unknown:${JSON.stringify(handler)}`;
  }
}

function getMatcherValue(input: HookInput): string | undefined {
  const eventName = input.hook_event_name as HookEventName;

  if (NO_MATCHER_EVENTS.includes(eventName)) {
    return undefined;
  }

  const field = MATCHER_FIELD_MAP[eventName];
  if (!field) return undefined;

  return (input as any)[field] as string | undefined;
}

export async function runHooks(
  config: HooksConfig,
  input: HookInput,
  cwd: string = process.cwd(),
): Promise<HookEventResult> {
  const eventName = input.hook_event_name;
  const matcherValue = getMatcherValue(input);

  const matchingGroups = getMatchingHookGroups(config, eventName, matcherValue);

  if (matchingGroups.length === 0) {
    return { blocked: false, results: [] };
  }

  // Collect all handlers, deduplicating by key
  const seen = new Set<string>();
  const handlers: HookHandler[] = [];

  for (const group of matchingGroups) {
    for (const handler of group.hooks) {
      const key = getHandlerDedupeKey(handler);
      if (!seen.has(key)) {
        seen.add(key);
        handlers.push(handler);
      }
    }
  }

  if (handlers.length === 0) {
    return { blocked: false, results: [] };
  }

  // Separate async (fire-and-forget) from sync handlers
  const syncHandlers: HookHandler[] = [];
  const asyncHandlers: HookHandler[] = [];

  for (const handler of handlers) {
    if (handler.type === "command" && handler.async) {
      asyncHandlers.push(handler);
    } else {
      syncHandlers.push(handler);
    }
  }

  // Fire async hooks (don't await)
  for (const handler of asyncHandlers) {
    executeHandler(handler, input, cwd).catch((err) => {
      logger.warn("Async hook failed:", err);
    });
  }

  // Execute sync hooks in parallel
  const results = await Promise.all(
    syncHandlers.map((handler) => executeHandler(handler, input, cwd)),
  );

  // Aggregate results
  return aggregateResults(results, eventName);
}

function aggregateResults(
  results: HookExecutionResult[],
  eventName: string,
): HookEventResult {
  const eventResult: HookEventResult = {
    blocked: false,
    results,
  };

  const additionalContextParts: string[] = [];

  for (const result of results) {
    // Check for blocking
    if (result.blocked) {
      eventResult.blocked = true;
      if (!eventResult.blockReason) {
        eventResult.blockReason = result.blockReason;
      }
    }

    const output = result.output;
    if (!output?.hookSpecificOutput) {
      // For exit 0 with no JSON output, stdout can be context
      // (for UserPromptSubmit and SessionStart)
      if (
        result.exitCode === 0 &&
        result.stdout &&
        (eventName === "UserPromptSubmit" || eventName === "SessionStart")
      ) {
        additionalContextParts.push(result.stdout);
      }
      continue;
    }

    const specific = output.hookSpecificOutput;

    // Extract additionalContext from any hook that supports it
    if ("additionalContext" in specific && specific.additionalContext) {
      additionalContextParts.push(specific.additionalContext);
    }

    // Event-specific aggregation
    switch (specific.hookEventName) {
      case "PreToolUse":
        if (specific.permissionDecision) {
          eventResult.permissionDecision = specific.permissionDecision;
          eventResult.permissionDecisionReason =
            specific.permissionDecisionReason;
          if (specific.permissionDecision === "deny") {
            eventResult.blocked = true;
            eventResult.blockReason =
              specific.permissionDecisionReason ||
              output.reason ||
              "Blocked by hook";
          }
        }
        if (specific.updatedInput) {
          eventResult.updatedInput = specific.updatedInput;
        }
        break;

      case "PermissionRequest":
        eventResult.permissionRequestDecision = specific.decision;
        if (specific.decision.behavior === "deny") {
          eventResult.blocked = true;
          eventResult.blockReason =
            "message" in specific.decision
              ? specific.decision.message || "Denied by hook"
              : "Denied by hook";
        }
        break;

      // Other events: additionalContext already handled above
      default:
        break;
    }
  }

  if (additionalContextParts.length > 0) {
    eventResult.additionalContext = additionalContextParts.join("\n");
  }

  return eventResult;
}
