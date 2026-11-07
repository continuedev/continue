/**
 * Hooks wired into executeStreamedToolCalls. Real hook commands run through the
 * real runner; only the services, the permission policy and the tool itself
 * are faked.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { runHooks } from "../hooks/hookRunner.js";
import type { HooksConfig } from "../hooks/types.js";
import type { PreprocessedToolCall, Tool } from "../tools/types.js";

let hooksConfig: HooksConfig = {};
let policy: "allow" | "ask" | "exclude" = "allow";
let dir: string;
const permissionSaw: unknown[] = [];

vi.mock("../services/index.js", () => ({
  services: {
    chatHistory: { addToolResult: vi.fn(), updateToolStatus: vi.fn() },
    hooks: {
      isReady: () => true,
      fireEvent: (input: any) => runHooks(hooksConfig, input, dir),
    },
    toolPermissions: { isReady: () => false },
  },
  serviceContainer: {
    get: vi.fn().mockResolvedValue({ permissions: { policies: [] } }),
  },
  SERVICE_NAMES: { TOOL_PERMISSIONS: "toolPermissions" },
}));

vi.mock("../permissions/permissionChecker.js", () => ({
  checkToolPermission: vi.fn((call: any) => {
    permissionSaw.push(call.arguments);
    return { permission: policy };
  }),
}));

const executeToolCall = vi.fn();
vi.mock("../tools/index.js", () => ({
  executeToolCall: (...args: unknown[]) => executeToolCall(...args),
  getAllAvailableTools: vi.fn().mockResolvedValue([]),
  validateToolCallArgsPresent: (call: any, tool: Tool) => {
    for (const key of tool.parameters.required ?? []) {
      if (call.arguments?.[key] === undefined) {
        throw new Error(`Missing required argument: ${key}`);
      }
    }
  },
}));

import { executeStreamedToolCalls } from "./streamChatResponse.helpers.js";

const tool: Tool = {
  name: "Bash",
  displayName: "Bash",
  description: "run",
  parameters: {
    type: "object",
    required: ["command"],
    properties: { command: { type: "string", description: "c" } },
  },
  preprocess: async (args) => ({ args: { ...args, preprocessed: true } }),
  run: async () => "ran",
  isBuiltIn: true,
};

const makeCall = (command = "ls", id = "call-1"): PreprocessedToolCall => ({
  id,
  name: "Bash",
  arguments: { command },
  argumentsStr: JSON.stringify({ command }),
  startNotified: false,
  tool,
});

function script(name: string, body: string): string {
  fs.writeFileSync(path.join(dir, `${name}.cjs`), body);
  return `node ${name}.cjs`;
}
const json = (value: unknown) =>
  `console.log(${JSON.stringify(JSON.stringify(value))})`;

const pre = (...commands: string[]): HooksConfig => ({
  PreToolUse: [
    { hooks: commands.map((command) => ({ type: "command", command })) },
  ],
});

const run = (calls = [makeCall()], isHeadless = false) =>
  executeStreamedToolCalls(calls, undefined, isHeadless);

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tool-hooks-"));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  hooksConfig = {};
  policy = "allow";
  permissionSaw.length = 0;
  executeToolCall.mockReset().mockResolvedValue("tool output");
});

describe("PreToolUse: blocking", () => {
  it("runs the tool when no hook is configured", async () => {
    const { chatHistoryEntries, hasRejection } = await run();
    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(chatHistoryEntries[0]).toMatchObject({
      content: "tool output",
      status: "done",
    });
    expect(hasRejection).toBe(false);
  });

  it("does not run the tool when a hook blocks, and tells the model why", async () => {
    hooksConfig = pre(
      script("deny", `console.error("no force pushes"); process.exit(2)`),
    );
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(chatHistoryEntries[0].status).toBe("canceled");
    expect(chatHistoryEntries[0].content).toBe(
      "Blocked by a hook: no force pushes",
    );
  });

  it("is not a rejection, so a headless run carries on", async () => {
    hooksConfig = pre(script("deny2", `process.exit(2)`));
    const { hasRejection } = await run([makeCall()], true);
    expect(hasRejection).toBe(false);
  });

  it("blocks before the permission check, so the user is not asked", async () => {
    policy = "ask";
    hooksConfig = pre(script("deny3", `process.exit(2)`));
    await run();
    expect(permissionSaw).toHaveLength(0);
  });

  it("blocks when a hook crashes, and names the hook (fails closed)", async () => {
    hooksConfig = pre(script("crash", `process.exit(1)`));
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(String(chatHistoryEntries[0].content)).toContain("crash.cjs");
    expect(String(chatHistoryEntries[0].content)).toContain(
      "exited with code 1",
    );
  });

  it("only blocks the call it matched, not the others in the batch", async () => {
    hooksConfig = {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: script(
                "only-rm",
                `let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const i=JSON.parse(s);process.exit(JSON.stringify(i.tool_input).includes("rm")?2:0)})`,
              ),
            },
          ],
        },
      ],
    };
    const { chatHistoryEntries } = await run([
      makeCall("rm -rf /", "a"),
      makeCall("ls", "b"),
    ]);
    expect(chatHistoryEntries.map((e) => e.status)).toEqual([
      "canceled",
      "done",
    ]);
    expect(executeToolCall).toHaveBeenCalledTimes(1);
  });
});

describe("PreToolUse: changed arguments", () => {
  const rewrite = (command: string) =>
    script(
      "rewrite",
      json({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          updatedInput: { command },
        },
      }),
    );

  it("runs the tool with the new arguments", async () => {
    hooksConfig = pre(rewrite("ls -la"));
    await run();
    const ran = executeToolCall.mock.calls[0][0] as PreprocessedToolCall;
    expect(ran.arguments).toEqual({ command: "ls -la" });
  });

  it("re-runs preprocess on the new arguments", async () => {
    hooksConfig = pre(rewrite("ls -la"));
    await run();
    const ran = executeToolCall.mock.calls[0][0] as PreprocessedToolCall;
    // The tool uses preprocessResult.args over arguments, so a stale value
    // here would silently ignore the hook.
    expect(ran.preprocessResult?.args).toEqual({
      command: "ls -la",
      preprocessed: true,
    });
  });

  it("shows the permission check the new arguments, not the old", async () => {
    hooksConfig = pre(rewrite("echo safe"));
    await run([makeCall("rm -rf /")]);
    expect(permissionSaw).toEqual([{ command: "echo safe" }]);
  });

  it("blocks when the new arguments are not valid for the tool", async () => {
    hooksConfig = pre(
      script(
        "bad-args",
        json({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            updatedInput: { wrong: 1 },
          },
        }),
      ),
    );
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(String(chatHistoryEntries[0].content)).toContain(
      "Missing required argument: command",
    );
  });

  it("leaves the original call untouched", async () => {
    hooksConfig = pre(rewrite("ls -la"));
    const call = makeCall("ls");
    await run([call]);
    expect(call.arguments).toEqual({ command: "ls" });
  });
});

describe("PreToolUse: against the permission policy", () => {
  const decide = (decision: "allow" | "ask" | "deny") =>
    script(
      `decide-${decision}`,
      json({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          permissionDecisionReason: "because",
        },
      }),
    );

  it("allow skips the question for a call the policy would ask about", async () => {
    policy = "ask";
    hooksConfig = pre(decide("allow"));
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(chatHistoryEntries[0].status).toBe("done");
  });

  it("allow never overrides a policy that excludes the tool", async () => {
    policy = "exclude";
    hooksConfig = pre(decide("allow"));
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(chatHistoryEntries[0].content).toBe(
      "Command blocked by security policy",
    );
  });

  it("ask turns an allowed call into one that needs a person", async () => {
    policy = "allow";
    hooksConfig = pre(decide("ask"));
    // Headless has no one to ask, so it is refused by policy.
    const { chatHistoryEntries, hasRejection } = await run([makeCall()], true);
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(chatHistoryEntries[0].content).toBe(
      "Command blocked by security policy",
    );
    expect(hasRejection).toBe(true);
  });

  it("deny blocks whatever the policy says", async () => {
    policy = "allow";
    hooksConfig = pre(decide("deny"));
    const { chatHistoryEntries } = await run();
    expect(executeToolCall).not.toHaveBeenCalled();
    expect(String(chatHistoryEntries[0].content)).toContain("because");
  });

  it("deny wins over an allow from another hook", async () => {
    policy = "ask";
    hooksConfig = pre(decide("allow"), decide("deny"));
    await run();
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it("changes nothing when the hook has no opinion", async () => {
    policy = "allow";
    hooksConfig = pre(script("quiet", ""));
    await run();
    expect(executeToolCall).toHaveBeenCalledTimes(1);
  });
});

describe("PostToolUse", () => {
  const post = (command: string): HooksConfig => ({
    PostToolUse: [{ hooks: [{ type: "command", command }] }],
  });

  it("passes the result through when hooks add nothing", async () => {
    hooksConfig = post(script("post-quiet", ""));
    const { chatHistoryEntries } = await run();
    expect(chatHistoryEntries[0].content).toBe("tool output");
  });

  it("appends context a hook returns, marked as hook output", async () => {
    hooksConfig = post(
      script(
        "post-context",
        json({
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: "lint: 2 warnings",
          },
        }),
      ),
    );
    const { chatHistoryEntries } = await run();
    expect(chatHistoryEntries[0].content).toBe(
      "tool output\n\n[Hook output]\nlint: 2 warnings",
    );
    expect(chatHistoryEntries[0].status).toBe("done");
  });

  it("a hook that blocks only adds a note, since the call already happened", async () => {
    hooksConfig = post(
      script("post-block", `console.error("tests fail"); process.exit(2)`),
    );
    const { chatHistoryEntries } = await run();
    expect(chatHistoryEntries[0].status).toBe("done");
    expect(String(chatHistoryEntries[0].content)).toContain(
      "A hook flagged this result: tests fail",
    );
  });

  it("a crashing hook never turns a good result into an error", async () => {
    hooksConfig = post(script("post-crash", `process.exit(1)`));
    const { chatHistoryEntries } = await run();
    expect(chatHistoryEntries[0]).toMatchObject({
      content: "tool output",
      status: "done",
    });
  });

  it("does not run when the tool was blocked", async () => {
    const marker = path.join(dir, "post-ran.txt");
    fs.rmSync(marker, { force: true });
    hooksConfig = {
      PreToolUse: pre(script("blocker", `process.exit(2)`)).PreToolUse,
      PostToolUse: post(
        script(
          "post-mark",
          `require("fs").writeFileSync(${JSON.stringify(marker)}, "x")`,
        ),
      ).PostToolUse,
    };
    await run();
    expect(fs.existsSync(marker)).toBe(false);
  });
});

describe("PostToolUseFailure", () => {
  it("runs when the tool throws, and the error still reaches the model", async () => {
    const marker = path.join(dir, "failure-ran.txt");
    fs.rmSync(marker, { force: true });
    executeToolCall.mockRejectedValue(new Error("disk full"));
    hooksConfig = {
      PostToolUseFailure: [
        {
          hooks: [
            {
              type: "command",
              command: script(
                "on-failure",
                `let s="";process.stdin.on("data",d=>s+=d).on("end",()=>require("fs").writeFileSync(${JSON.stringify(
                  marker,
                )}, JSON.parse(s).error))`,
              ),
            },
          ],
        },
      ],
    };
    const { chatHistoryEntries } = await run();
    expect(chatHistoryEntries[0].status).toBe("errored");
    expect(String(chatHistoryEntries[0].content)).toContain("disk full");
    expect(fs.readFileSync(marker, "utf-8")).toContain("disk full");
  });
});

describe("tool run context", () => {
  it("hands each tool run the turn's signal and the session's permission prompt", async () => {
    const turn = new AbortController();
    const onToolPermissionRequest = vi.fn();
    await executeStreamedToolCalls(
      [makeCall()],
      { onToolPermissionRequest },
      false,
      turn.signal,
    );
    expect(executeToolCall).toHaveBeenCalledWith(expect.anything(), {
      parallelToolCallCount: 1,
      abortSignal: turn.signal,
      onToolPermissionRequest,
    });
  });
});
