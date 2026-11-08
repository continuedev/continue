import type { IDE, LoopCheckResult, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  consumeLoopGrant,
  holdCheck,
  holdQuestion,
  LOOP_LIMITS,
  recordCheck,
  startCheck,
} from "core/util/loopMode";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectApprovalSettings } from "../selectors/selectAutoApproval";
import { grantKey } from "../slices/blockedCallsSlice";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { AppThunkDispatch, RootState } from "../store";
import { commitLoop } from "../util/loopCommit";
import { evaluateToolPolicy } from "./evaluateToolPolicies";

/**
 * Loop mode's item checks (TaskItem.check) in the gui: decideNext's "check"
 * action. The command is decided as a run_terminal_command call with that
 * command would be, so the person's rules, protected paths and approval mode
 * apply; one that would ask is held as an approval question in the inbox and
 * runs once allowed. Then it runs in the first workspace folder.
 */

/** A check that runs longer than this counts as failed. */
export const LOOP_CHECK_TIMEOUT_MS = 10 * 60_000;

export type CheckPermission =
  | { kind: "run" }
  | { kind: "refused"; reason: string }
  | { kind: "ask"; reason?: string };

/**
 * What the person's rules say about running `command` as a terminal command,
 * through the same evaluation as a real run_terminal_command call in Agent
 * mode (evaluateToolPolicy: the tool's setting, core's rules, protected paths,
 * the approval mode). Auto mode's reviewer is not asked: a call it would
 * review is left for the person, which is never more permissive.
 */
export async function checkPermission(
  state: RootState,
  ideMessenger: IIdeMessenger,
  command: string,
): Promise<CheckPermission> {
  const name = BuiltInToolNames.RunTerminalCommand;
  const tool = state.config.config.tools.find((t) => t.function.name === name);
  const setting =
    state.ui.toolSettings[name] ??
    tool?.defaultToolPolicy ??
    DEFAULT_TOOL_SETTING;
  if (
    !tool ||
    setting === "disabled" ||
    state.ui.toolGroupSettings[tool.group] === "exclude"
  ) {
    return {
      kind: "refused",
      reason: "The terminal tool is turned off, so the check cannot run.",
    };
  }
  const parsedArgs = { command };
  const call: ToolCallState = {
    toolCallId: `loop-check-${Date.now()}`,
    toolCall: {
      id: `loop-check-${Date.now()}`,
      type: "function",
      function: { name, arguments: JSON.stringify(parsedArgs) },
    },
    status: "generated",
    parsedArgs,
    tool,
  };
  let evaluated;
  try {
    evaluated = await evaluateToolPolicy(
      ideMessenger,
      [tool],
      call,
      state.ui.toolSettings,
      selectApprovalSettings(state),
      "agent",
    );
  } catch (e) {
    return {
      kind: "refused",
      reason: `The rules could not be checked: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  switch (evaluated.policy) {
    case "allowedWithoutPermission":
      return { kind: "run" };
    case "allowedWithPermission":
      return { kind: "ask", reason: evaluated.reason };
    default:
      return {
        kind: "refused",
        reason:
          evaluated.reason ??
          (evaluated.source === "deny-rule"
            ? "Blocked by a rule in the person's config."
            : "Refused by the terminal command security policy."),
      };
  }
}

/** A workspace folder's URI as a path for the command's cwd, if it is local. */
export function workspacePath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  if (!uri.includes("://")) return uri;
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") return undefined;
    let path = decodeURIComponent(url.pathname);
    // file:///C:/x is C:/x
    if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
    return url.host ? `//${url.host}${path}` : path;
  } catch {
    return undefined;
  }
}

function tail(text: string): string {
  return text.slice(-LOOP_LIMITS.maxCheckOutput);
}

/**
 * Runs the command through the IDE. VS Code's subprocess resolves with
 * [stdout, stderr] on exit 0 and rejects with stderr otherwise, so that is
 * passed or failed; the exit code itself is not known.
 */
export async function runCheckCommand(
  ide: IDE,
  command: string,
  cwd: string | undefined,
  timeoutMs: number = LOOP_CHECK_TIMEOUT_MS,
): Promise<Omit<LoopCheckResult, "at">> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const result = await Promise.race([ide.subprocess(command, cwd), timeout]);
    if (result === "timeout") {
      return {
        status: "failed",
        command,
        exitCode: null,
        output: `The check timed out after ${Math.round(timeoutMs / 60_000)} minutes.`,
      };
    }
    const [stdout, stderr] = result;
    return {
      status: "passed",
      command,
      exitCode: 0,
      output: tail([stdout, stderr].filter((s) => s?.trim()).join("\n")),
    };
  } catch (e) {
    const output = e instanceof Error ? e.message : String(e ?? "");
    return {
      status: "failed",
      command,
      exitCode: null,
      output: tail(output) || "(no output)",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * decideNext's "check" action: start the check, decide whether it may run,
 * and run it or hold it. Resolves when the check has run (so useLoopDriver
 * takes no other step meanwhile) or is held or refused.
 */
export async function runLoopCheck(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  ideMessenger: IIdeMessenger,
  action: { itemId: string; command: string },
  now: Date,
): Promise<void> {
  const { itemId, command } = action;
  const before = getState().session.loop;
  if (!before) return;
  let loop = startCheck(before, itemId, getState().session.history.length, now);
  commitLoop(dispatch, getState, loop);
  const startedAt = loop.current?.startedAt;

  const permission = await checkPermission(getState(), ideMessenger, command);
  loop = getState().session.loop ?? loop;
  if (!isThisCheck(loop, itemId, startedAt)) return;

  if (permission.kind === "refused") {
    commitLoop(
      dispatch,
      getState,
      recordCheck(
        loop,
        { status: "refused", command, output: permission.reason },
        new Date(),
      ),
    );
    return;
  }
  if (permission.kind === "ask") {
    // Allowed from the inbox: answerLoop added the grant, used once here
    const key = grantKey(BuiltInToolNames.RunTerminalCommand, { command });
    const grant = consumeLoopGrant(loop, key);
    if (grant.granted) {
      loop = grant.loop;
    } else {
      const held = holdQuestion(
        loop,
        {
          itemId,
          question: `Allow this call? ${command}${permission.reason ? ` (${permission.reason})` : ""}`,
          kind: "approval",
          approval: {
            toolName: BuiltInToolNames.RunTerminalCommand,
            summary: command,
            grantKey: key,
          },
        },
        new Date(),
      );
      commitLoop(
        dispatch,
        getState,
        held.ok
          ? holdCheck(held.loop)
          : recordCheck(
              loop,
              {
                status: "refused",
                command,
                output: `The check needs your approval and could not be held: ${held.error}`,
              },
              new Date(),
            ),
      );
      return;
    }
  }
  commitLoop(dispatch, getState, loop);

  const dirs = await ideMessenger.ide.getWorkspaceDirs().catch(() => []);
  const result = await runCheckCommand(
    ideMessenger.ide,
    command,
    workspacePath(dirs[0]),
  );
  // Stopped meanwhile: the item stays checking, and its check runs again
  const after = getState().session.loop;
  if (!after || !isThisCheck(after, itemId, startedAt)) return;
  commitLoop(dispatch, getState, recordCheck(after, result, new Date()));
}

function isThisCheck(
  loop: NonNullable<RootState["session"]["loop"]>,
  itemId: string,
  startedAt: string | undefined,
): boolean {
  return (
    loop.current?.kind === "check" &&
    loop.current.itemId === itemId &&
    loop.current.startedAt === startedAt
  );
}
