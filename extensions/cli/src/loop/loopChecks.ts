import { exec } from "child_process";

import { holdCheck, recordCheck } from "core/util/loopMode.js";

import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../services/index.js";
import type { ToolPermissionServiceState } from "../services/ToolPermissionService.js";
import { getSessionLoop } from "../session.js";
import { checkToolPermissionApproval } from "../stream/streamChatResponse.helpers.js";
import { runTerminalCommandTool } from "../tools/runTerminalCommand.js";
import type { PreprocessedToolCall } from "../tools/types.js";
import { logger } from "../util/logger.js";

import { commitLoop } from "./loopSession.js";

/**
 * Loop mode's checks in the CLI: the harness runs an item's `check:` command
 * (TaskItem.check) after the item reported done (core's "check" action). The
 * command goes through the same permission decision as a Bash call the model
 * makes: the person's rules and protected paths decide, a call that would ask
 * is held as an approval question in the inbox (loopHolds.ts, as `current`
 * names the item), and a refused one leaves the item done without its check.
 */

/** How long a check may run before it counts as failed. */
export const LOOP_CHECK_TIMEOUT_MS = 10 * 60 * 1000;

export interface LoopCheckStep {
  kind: "check";
  itemId: string;
  command: string;
}

export interface CheckRun {
  exitCode: number | null;
  output: string;
}

/** Runs a command in the workspace and keeps what it printed. */
export function runCheckCommand(
  command: string,
  cwd = process.cwd(),
): Promise<CheckRun> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: LOOP_CHECK_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (!error) {
          resolve({ exitCode: 0, output });
          return;
        }
        const timedOut = error.killed && error.signal === "SIGTERM";
        resolve({
          exitCode: typeof error.code === "number" ? error.code : null,
          output: timedOut
            ? `${output}\n(stopped after ${LOOP_CHECK_TIMEOUT_MS / 60000} minutes)`.trim()
            : output || error.message,
        });
      },
    );
  });
}

/**
 * Runs the check the loop asked for (nextLoopTurn returned this step, with
 * `current` set by core's startCheck) and records the result.
 */
export async function runLoopCheck(
  step: LoopCheckStep,
  run: (command: string) => Promise<CheckRun> = runCheckCommand,
): Promise<void> {
  const { command } = step;
  const call = {
    id: `loop-check-${step.itemId}`,
    name: runTerminalCommandTool.name,
    arguments: { command },
    argumentsStr: JSON.stringify({ command }),
    startNotified: true,
    tool: runTerminalCommandTool,
  } as PreprocessedToolCall;

  try {
    const permissions = await serviceContainer.get<ToolPermissionServiceState>(
      SERVICE_NAMES.TOOL_PERMISSIONS,
    );
    const decision = await checkToolPermissionApproval(
      permissions.permissions,
      call,
      undefined,
      services.toolPermissions.isHeadless(),
    );
    if (!decision.approved) {
      const loop = getSessionLoop();
      if (!loop) return;
      commitLoop(
        decision.denialReason === "loop"
          ? holdCheck(loop)
          : recordCheck(
              loop,
              {
                status: "refused",
                command,
                output: decision.denialMessage ?? "A rule refused the command.",
              },
              new Date(),
            ),
      );
      return;
    }

    const result = await run(command);
    const loop = getSessionLoop();
    if (!loop) return;
    commitLoop(
      recordCheck(
        loop,
        {
          status: result.exitCode === 0 ? "passed" : "failed",
          command,
          exitCode: result.exitCode,
          output: result.output,
        },
        new Date(),
      ),
    );
  } catch (error) {
    logger.error("Loop check failed to run", { error });
    const loop = getSessionLoop();
    if (loop?.current?.kind === "check") {
      commitLoop(
        recordCheck(
          loop,
          {
            status: "failed",
            command,
            exitCode: null,
            output: error instanceof Error ? error.message : String(error),
          },
          new Date(),
        ),
      );
    }
  }
}
