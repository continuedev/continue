import { execFile, spawn } from "child_process";
import type { ChildProcess } from "child_process";

import { logger } from "../util/logger.js";

import { getMatchingHookGroups } from "./hookConfig.js";
import {
  BLOCKING_EVENTS,
  MATCHER_FIELD_MAP,
  NO_MATCHER_EVENTS,
} from "./types.js";
import type {
  CommandHookHandler,
  HookEventName,
  HookEventResult,
  HookExecutionResult,
  HookHandler,
  HookInput,
  HookOutput,
  HttpHookHandler,
  PreToolUseHookOutput,
} from "./types.js";
import type { HooksConfig } from "./types.js";

/** Command hooks on events that can block the action wait this long. */
const BLOCKING_COMMAND_TIMEOUT_SECONDS = 30;
/** Command hooks on other events (notifications, logging) may run longer. */
const DEFAULT_COMMAND_TIMEOUT_SECONDS = 600;
const DEFAULT_HTTP_TIMEOUT_SECONDS = 30;
/** Output kept from a hook; the rest is dropped. */
const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;
/** How long after the hook's shell exits to wait for its last output. */
const EXIT_GRACE_MS = 100;

function tryParseJson(str: string): HookOutput | null {
  const trimmed = str.trim();
  if (!trimmed || !trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as HookOutput;
  } catch {
    return null;
  }
}

/** A hook that did not complete normally. Whether it blocks is decided later. */
function failure(
  reason: string,
  extra: Partial<HookExecutionResult> = {},
): HookExecutionResult {
  return {
    output: null,
    stdout: "",
    stderr: reason,
    exitCode: 1,
    blocked: false,
    failed: true,
    failureReason: reason,
    ...extra,
  };
}

/**
 * Stop a hook and everything it started. A plain kill reaches only the shell,
 * so a hook that launched a long-running program would keep running.
 */
function killProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform === "win32") {
      execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
    } else {
      // The hook was started as a process group leader; -pid is the group.
      process.kill(-child.pid, "SIGKILL");
    }
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

function executeCommandHook(
  handler: CommandHookHandler,
  input: HookInput,
  cwd: string,
): Promise<HookExecutionResult> {
  const timeoutSeconds =
    handler.timeout ??
    (BLOCKING_EVENTS.includes(input.hook_event_name)
      ? BLOCKING_COMMAND_TIMEOUT_SECONDS
      : DEFAULT_COMMAND_TIMEOUT_SECONDS);

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

    let settled = false;
    const finish = (result: HookExecutionResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(shell, shellArgs, {
      cwd,
      env,
      // Own process group on Unix, so a timeout can stop everything the hook
      // started. On Windows taskkill /T walks the tree instead.
      detached: process.platform !== "win32",
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      killProcessTree(child);
      finish(failure(`timed out after ${timeoutSeconds} s`));
    }, timeoutSeconds * 1000);

    let stdout = "";
    let stderr = "";
    let captured = 0;
    const capture = (chunk: string, into: "stdout" | "stderr") => {
      captured += chunk.length;
      if (captured > MAX_CAPTURE_BYTES) {
        killProcessTree(child);
        finish(failure(`output was larger than ${MAX_CAPTURE_BYTES} bytes`));
        return;
      }
      if (into === "stdout") stdout += chunk;
      else stderr += chunk;
    };

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (data: string) => capture(data, "stdout"));

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (data: string) => capture(data, "stderr"));

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

    // "close" waits for every holder of the output pipes, so a hook that
    // backgrounds a process (`notify-send ... &`) would run into its timeout
    // and fail closed. Finish shortly after the shell exits instead; the
    // background process keeps running, its output drained but not collected.
    child.on("exit", (code, signal) => {
      setTimeout(() => {
        if (settled) return;
        for (const stream of [child.stdout, child.stderr]) {
          stream?.removeAllListeners("data");
          stream?.resume();
          (stream as { unref?: () => void } | null)?.unref?.();
        }
        onDone(code, signal);
      }, EXIT_GRACE_MS);
    });

    child.on("close", (code, signal) => onDone(code, signal));

    function onDone(code: number | null, signal: NodeJS.Signals | null) {
      if (code === null) {
        // Killed from outside; a missing exit code is not success.
        finish(failure(`was stopped by ${signal ?? "a signal"}`));
        return;
      }
      const output = tryParseJson(stdout);

      // Determine if the hook blocked the action
      let blocked = false;
      let blockReason: string | undefined;

      if (code === 2) {
        blocked = true;
        blockReason = stderr.trim() || "Blocked by hook";
      } else if (output?.decision === "block") {
        blocked = true;
        blockReason = output.reason || stderr.trim() || "Blocked by hook";
      }

      const base: HookExecutionResult = {
        output,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        blocked,
        blockReason,
      };
      // Exit 0 is success and exit 2 is a deliberate block. Any other code
      // means the hook itself went wrong.
      if (code !== 0 && code !== 2) {
        const detail = stderr.trim().split("\n")[0];
        base.failed = true;
        base.failureReason = `exited with code ${code}${detail ? `: ${detail}` : ""}`;
      }
      finish(base);
    }

    child.on("error", (error) => {
      logger.warn(`Hook command failed: ${handler.command}`, error);
      finish(failure(`could not start: ${error.message}`));
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

    const response = await fetch(handler.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn(`HTTP hook returned ${response.status}: ${handler.url}`);
      return failure(`${handler.url} returned HTTP ${response.status}`);
    }

    // The timer stays armed while the body is read, so a server that sends
    // headers and then stalls is still cut off.
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
    logger.warn(`HTTP hook failed: ${handler.url}`, error);
    const aborted = controller.signal.aborted;
    const detail = error instanceof Error ? error.message : String(error);
    return failure(
      aborted
        ? `${handler.url} timed out after ${timeoutMs / 1000} s`
        : `${handler.url} failed: ${detail}`,
    );
  } finally {
    clearTimeout(timeout);
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
      // Not implemented. A policy written as a prompt or agent hook must not
      // be skipped without anyone noticing, so this counts as a failure.
      logger.warn(`Hook type "${handler.type}" is not supported yet`);
      return failure(`handler type "${handler.type}" is not supported yet`);
    default:
      logger.warn(`Unknown hook handler type: ${(handler as any).type}`);
      return failure(
        `unknown handler type "${(handler as { type?: string }).type}"`,
      );
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
  results.forEach((result, i) =>
    applyFailurePolicy(syncHandlers[i], result, eventName),
  );

  // Aggregate results
  return aggregateResults(results, eventName);
}

/** A short name for a handler, for messages the user and the model read. */
function describeHandler(handler: HookHandler): string {
  switch (handler.type) {
    case "command": {
      const text = handler.command.replace(/\s+/g, " ").trim();
      return text.length > 60 ? `${text.slice(0, 57)}...` : text;
    }
    case "http":
      return handler.url;
    default:
      return `${(handler as { type?: string }).type} hook`;
  }
}

/**
 * A hook that failed stops the action when the event can stop something,
 * unless the hook says `onError: "allow"`. On other events the action has
 * already happened, so the failure is only logged.
 */
function applyFailurePolicy(
  handler: HookHandler,
  result: HookExecutionResult,
  eventName: string,
): void {
  if (!result.failed) return;
  const what = `Hook "${describeHandler(handler)}" ${result.failureReason}`;
  const canBlock = BLOCKING_EVENTS.includes(eventName as HookEventName);
  if (canBlock && handler.onError !== "allow") {
    result.blocked = true;
    result.blockReason = `${what}. The action was blocked because hooks fail closed; set "onError": "allow" on the hook to let it through.`;
    logger.warn(`${what}; blocking ${eventName}`);
  } else {
    logger.warn(`${what}; continuing`);
  }
}

const DECISION_RANK = { allow: 1, ask: 2, deny: 3 } as const;

/**
 * Folds one hook's PreToolUse output into the event result. The strictest
 * decision wins whatever the order of the hooks: deny, then ask, then allow.
 * Returns the rank of the decision now held, to pass to the next call.
 */
function mergePreToolUse(
  eventResult: HookEventResult,
  specific: PreToolUseHookOutput,
  outputReason: string | undefined,
  decisionRank: number,
): number {
  const decision = specific.permissionDecision;
  let rank = decisionRank;
  if (decision && DECISION_RANK[decision] > rank) {
    rank = DECISION_RANK[decision];
    eventResult.permissionDecision = decision;
    eventResult.permissionDecisionReason = specific.permissionDecisionReason;
  }
  if (decision === "deny") {
    eventResult.blocked = true;
    // Keep the first blocking reason, as for every other block.
    eventResult.blockReason ||=
      specific.permissionDecisionReason || outputReason || "Blocked by hook";
  }
  if (specific.updatedInput) {
    if (eventResult.updatedInput) {
      logger.warn(
        "More than one PreToolUse hook returned updatedInput; the last one in config order is used",
      );
    }
    eventResult.updatedInput = specific.updatedInput;
  }
  return rank;
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
  // The strictest PreToolUse decision wins, whatever the order of the hooks.
  let decisionRank = 0;

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
        decisionRank = mergePreToolUse(
          eventResult,
          specific,
          output.reason,
          decisionRank,
        );
        break;

      case "PermissionRequest":
        // A deny is never replaced by a later allow.
        if (eventResult.permissionRequestDecision?.behavior !== "deny") {
          eventResult.permissionRequestDecision = specific.decision;
        }
        if (specific.decision.behavior === "deny") {
          eventResult.blocked = true;
          if (!eventResult.blockReason) {
            eventResult.blockReason =
              "message" in specific.decision
                ? specific.decision.message || "Denied by hook"
                : "Denied by hook";
          }
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
