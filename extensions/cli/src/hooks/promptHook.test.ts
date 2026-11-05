/**
 * UserPromptSubmit hooks: a hook can stop a prompt or add context to it.
 * Real hook commands run through the real runner.
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

import { runHooks } from "./hookRunner.js";
import {
  describePromptBlocked,
  runUserPromptSubmitHooks,
} from "./promptHook.js";
import type { HooksConfig } from "./types.js";

let hooksConfig: HooksConfig = {};
let dir: string;

vi.mock("../services/index.js", () => ({
  services: {
    hooks: {
      isReady: () => true,
      fireEvent: (input: any) => runHooks(hooksConfig, input, dir),
    },
    toolPermissions: { isReady: () => false },
  },
}));

function script(name: string, body: string): string {
  fs.writeFileSync(path.join(dir, `${name}.cjs`), body);
  return `node ${name}.cjs`;
}
const onSubmit = (...commands: string[]): HooksConfig => ({
  UserPromptSubmit: [
    { hooks: commands.map((command) => ({ type: "command", command })) },
  ],
});

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-hooks-"));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  hooksConfig = {};
});

describe("runUserPromptSubmitHooks", () => {
  it("passes the prompt through when no hook is configured", async () => {
    expect(await runUserPromptSubmitHooks("fix the bug")).toEqual({
      prompt: "fix the bug",
    });
  });

  it("stops the prompt when a hook blocks it, with the reason", async () => {
    hooksConfig = onSubmit(
      script(
        "secret",
        `console.error("looks like an API key"); process.exit(2)`,
      ),
    );
    const r = await runUserPromptSubmitHooks("my key is sk-123");
    expect(r.blockedReason).toBe("looks like an API key");
    expect(describePromptBlocked(r.blockedReason!)).toBe(
      "Your message was not sent: a hook blocked it. looks like an API key",
    );
  });

  it("stops the prompt when a hook fails (fails closed)", async () => {
    hooksConfig = onSubmit(script("crash", `process.exit(1)`));
    const r = await runUserPromptSubmitHooks("hello");
    expect(r.blockedReason).toContain("exited with code 1");
  });

  it("lets the prompt through when a failing hook says onError allow", async () => {
    hooksConfig = {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: script("crash2", `process.exit(1)`),
              onError: "allow",
            },
          ],
        },
      ],
    };
    const r = await runUserPromptSubmitHooks("hello");
    expect(r).toEqual({ prompt: "hello" });
  });

  it("adds plain stdout as context after the prompt", async () => {
    hooksConfig = onSubmit(script("ctx", `console.log("branch: feature/x")`));
    const r = await runUserPromptSubmitHooks("what changed?");
    expect(r.prompt).toBe("what changed?\n\n[Hook context]\nbranch: feature/x");
    expect(r.blockedReason).toBeUndefined();
  });

  it("adds structured additionalContext too", async () => {
    hooksConfig = onSubmit(
      script(
        "ctx2",
        `console.log(JSON.stringify({hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:"ticket ABC-1"}}))`,
      ),
    );
    const r = await runUserPromptSubmitHooks("go");
    expect(r.prompt).toBe("go\n\n[Hook context]\nticket ABC-1");
  });

  it("gives the hook the prompt on stdin", async () => {
    hooksConfig = onSubmit(
      script(
        "echo-prompt",
        `let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("saw: "+JSON.parse(s).prompt))`,
      ),
    );
    const r = await runUserPromptSubmitHooks("hello there");
    expect(r.prompt).toContain("saw: hello there");
  });
});
