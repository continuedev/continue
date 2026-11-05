/**
 * Hooks fail closed: a hook that times out, cannot start, exits with an
 * unexpected code, returns an HTTP error or has an unsupported handler type
 * blocks the actions it guards, unless the hook sets `onError: "allow"`.
 *
 * Hooks here are `node <script>` so the same tests run on Windows and Unix.
 */

import * as fs from "fs";
import * as http from "http";
import type { AddressInfo } from "net";
import * as os from "os";
import * as path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runHooks } from "./hookRunner.js";
import type { HookHandler, HookInput, HooksConfig } from "./types.js";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-fail-closed-"));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Writes a node script and returns the command that runs it from `dir`. */
function script(name: string, body: string): string {
  fs.writeFileSync(path.join(dir, `${name}.cjs`), body);
  return `node ${name}.cjs`;
}

const base = {
  session_id: "s",
  transcript_path: "",
  cwd: process.cwd(),
};

const preToolUse = (): HookInput => ({
  ...base,
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: {},
  tool_use_id: "t",
});

const postToolUse = (): HookInput => ({
  ...base,
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: {},
  tool_response: "ok",
  tool_use_id: "t",
});

const userPrompt = (): HookInput => ({
  ...base,
  hook_event_name: "UserPromptSubmit",
  prompt: "hi",
});

const stop = (): HookInput => ({
  ...base,
  hook_event_name: "Stop",
  stop_hook_active: false,
});

const permissionRequest = (): HookInput => ({
  ...base,
  hook_event_name: "PermissionRequest",
  tool_name: "Bash",
  tool_input: {},
});

const on = (
  event: keyof HooksConfig,
  ...hooks: HookHandler[]
): HooksConfig => ({ [event]: [{ hooks }] });

describe("a hook that leaves a background process", () => {
  // The shell exits at once, but `sleep` holds the output pipe. The runner
  // used to wait for the pipe, i.e. for the timeout, and then fail closed.
  it.skipIf(process.platform === "win32")(
    "finishes when the shell exits and does not block",
    async () => {
      const started = Date.now();
      const r = await runHooks(
        on("PreToolUse", {
          type: "command",
          command: "sleep 30 & echo started",
          timeout: 20,
        }),
        preToolUse(),
        dir,
      );
      expect(r.blocked).toBe(false);
      expect(r.results[0].failed).toBeUndefined();
      expect(Date.now() - started).toBeLessThan(10_000);
    },
    25_000,
  );
});

describe("command hooks fail closed", () => {
  const exit = (code: number) => script(`exit${code}`, `process.exit(${code})`);

  it("accepts exit 0", async () => {
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: exit(0) }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(false);
    expect(r.results[0].failed).toBeUndefined();
  });

  it("treats exit 2 as a deliberate block, not a failure", async () => {
    const cmd = script("deny", `console.error("no rm"); process.exit(2)`);
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: cmd }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe("no rm");
    expect(r.results[0].failed).toBeUndefined();
  });

  it("blocks on exit 1 and names the exit code and first stderr line", async () => {
    const cmd = script(
      "boom",
      `console.error("bad config\\nmore"); process.exit(1)`,
    );
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: cmd }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("exited with code 1: bad config");
    expect(r.blockReason).not.toContain("more");
    expect(r.blockReason).toContain('"onError": "allow"');
  });

  it("blocks when the command cannot start", async () => {
    const r = await runHooks(
      on("PreToolUse", {
        type: "command",
        command: "no_such_command_12345",
      }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(true);
    expect(r.results[0].failed).toBe(true);
  });

  it("lets the action through when the hook sets onError allow", async () => {
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: exit(1), onError: "allow" }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(false);
    expect(r.results[0].failed).toBe(true);
  });

  it("does not let onError allow override a deliberate exit 2", async () => {
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: exit(2), onError: "allow" }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(true);
  });

  it.each([
    ["PreToolUse", preToolUse],
    ["UserPromptSubmit", userPrompt],
    ["PermissionRequest", permissionRequest],
  ] as const)("blocks %s when the hook fails", async (event, make) => {
    const r = await runHooks(
      on(event, { type: "command", command: exit(1) }),
      make(),
      dir,
    );
    expect(r.blocked).toBe(true);
  });

  it.each([
    ["PostToolUse", postToolUse],
    ["Stop", stop],
  ] as const)(
    "only logs a failure on %s, which cannot undo anything",
    async (event, make) => {
      const r = await runHooks(
        on(event, { type: "command", command: exit(1) }),
        make(),
        dir,
      );
      expect(r.blocked).toBe(false);
      expect(r.results[0].failed).toBe(true);
    },
  );
});

describe("timeouts", () => {
  it("kills a hook that runs too long and blocks, within the limit", async () => {
    const cmd = script("hang", `setTimeout(() => {}, 60000)`);
    const started = Date.now();
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: cmd, timeout: 0.4 }),
      preToolUse(),
      dir,
    );
    expect(Date.now() - started).toBeLessThan(5000);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("timed out after 0.4 s");
  });

  it("is not fooled by the missing exit code of a killed process", async () => {
    // Before the fix a killed hook reported code null, which became 0.
    const cmd = script("hang2", `setTimeout(() => {}, 60000)`);
    const r = await runHooks(
      on("PreToolUse", { type: "command", command: cmd, timeout: 0.3 }),
      preToolUse(),
      dir,
    );
    expect(r.results[0].exitCode).not.toBe(0);
    expect(r.results[0].failed).toBe(true);
  });

  it("stops programs the hook started, not only the hook", async () => {
    const marker = path.join(dir, "grandchild-ran.txt");
    fs.rmSync(marker, { force: true });
    const cmd = script(
      "parent",
      `const { spawn } = require("child_process");
       spawn(process.execPath, ["-e", "setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 1500)"], { stdio: "ignore" });
       setTimeout(() => {}, 60000);`,
    );
    await runHooks(
      on("PreToolUse", { type: "command", command: cmd, timeout: 0.4 }),
      preToolUse(),
      dir,
    );
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("only logs a timeout on PostToolUse", async () => {
    const cmd = script("hang3", `setTimeout(() => {}, 60000)`);
    const r = await runHooks(
      on("PostToolUse", { type: "command", command: cmd, timeout: 0.3 }),
      postToolUse(),
      dir,
    );
    expect(r.blocked).toBe(false);
    expect(r.results[0].failed).toBe(true);
  });
});

describe("unsupported handlers", () => {
  it.each(["prompt", "agent"] as const)(
    "blocks PreToolUse for a %s hook, so a policy is never skipped silently",
    async (type) => {
      const r = await runHooks(
        on("PreToolUse", { type, prompt: "Is this safe?" }),
        preToolUse(),
        dir,
      );
      expect(r.blocked).toBe(true);
      expect(r.blockReason).toContain(
        `handler type "${type}" is not supported`,
      );
    },
  );

  it("can be allowed through while support is missing", async () => {
    const r = await runHooks(
      on("PreToolUse", {
        type: "prompt",
        prompt: "Is this safe?",
        onError: "allow",
      }),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(false);
  });

  it("blocks on a handler type nobody has heard of", async () => {
    const r = await runHooks(
      on("PreToolUse", { type: "carrier-pigeon" } as unknown as HookHandler),
      preToolUse(),
      dir,
    );
    expect(r.blocked).toBe(true);
  });
});

describe("http hooks fail closed", () => {
  const servers: http.Server[] = [];

  async function serve(handler: http.RequestListener): Promise<string> {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}/hook`;
  }

  afterAll(() => {
    for (const s of servers) {
      s.closeAllConnections?.();
      s.close();
    }
  });

  const run = (url: string, extra: Partial<HookHandler> = {}) =>
    runHooks(
      on("PreToolUse", { type: "http", url, ...extra } as HookHandler),
      preToolUse(),
      dir,
    );

  it("accepts a 200 response", async () => {
    const url = await serve((_req, res) => res.end("{}"));
    expect((await run(url)).blocked).toBe(false);
  });

  it("blocks on a server error and names the status", async () => {
    const url = await serve((_req, res) => {
      res.statusCode = 500;
      res.end("nope");
    });
    const r = await run(url);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("HTTP 500");
  });

  it("lets a server error through with onError allow", async () => {
    const url = await serve((_req, res) => {
      res.statusCode = 503;
      res.end();
    });
    expect((await run(url, { onError: "allow" })).blocked).toBe(false);
  });

  it("blocks when nothing is listening", async () => {
    const url = await serve((_req, res) => res.end());
    const server = servers[servers.length - 1];
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect((await run(url)).blocked).toBe(true);
  });

  it("blocks on a server that never answers", async () => {
    const url = await serve(() => {
      // never respond
    });
    const r = await run(url, { timeout: 0.4 });
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("timed out after 0.4 s");
  });

  it("blocks on a server that sends headers and then stalls the body", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write("{");
      // never end
    });
    const started = Date.now();
    const r = await run(url, { timeout: 0.4 });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(r.blocked).toBe(true);
  });

  it("honours a block decision in the body", async () => {
    const url = await serve((_req, res) =>
      res.end(JSON.stringify({ decision: "block", reason: "not today" })),
    );
    const r = await run(url);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe("not today");
    expect(r.results[0].failed).toBeUndefined();
  });
});

describe("decision precedence", () => {
  const decision = (name: string, permissionDecision: string) =>
    script(
      name,
      `console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: ${JSON.stringify(
        permissionDecision,
      )}, permissionDecisionReason: ${JSON.stringify(name)} } }))`,
    );
  const cmd = (command: string): HookHandler => ({ type: "command", command });
  const preWith = (...commands: string[]) =>
    runHooks(on("PreToolUse", ...commands.map(cmd)), preToolUse(), dir);

  it("deny wins when it comes first", async () => {
    const r = await preWith(
      decision("denier", "deny"),
      decision("allower", "allow"),
    );
    expect(r.blocked).toBe(true);
    expect(r.permissionDecision).toBe("deny");
    expect(r.permissionDecisionReason).toBe("denier");
  });

  it("deny wins when it comes last, and the decision agrees with blocked", async () => {
    const r = await preWith(
      decision("allower2", "allow"),
      decision("denier2", "deny"),
    );
    expect(r.blocked).toBe(true);
    // Before the fix the last hook won, so this read "allow" while blocked.
    expect(r.permissionDecision).toBe("deny");
  });

  it("ask beats allow, whatever the order", async () => {
    const a = await preWith(decision("a1", "ask"), decision("b1", "allow"));
    const b = await preWith(decision("b2", "allow"), decision("a2", "ask"));
    expect(a.permissionDecision).toBe("ask");
    expect(b.permissionDecision).toBe("ask");
    expect(a.blocked).toBe(false);
    expect(b.blocked).toBe(false);
  });

  it("keeps the first block reason when two hooks deny", async () => {
    const r = await preWith(
      decision("first", "deny"),
      decision("second", "deny"),
    );
    expect(r.blockReason).toBe("first");
  });

  it("a PermissionRequest deny is not replaced by a later allow", async () => {
    const permission = (name: string, behavior: string) =>
      cmd(
        script(
          name,
          `console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: ${JSON.stringify(
            behavior,
          )}, message: ${JSON.stringify(name)} } } }))`,
        ),
      );
    const r = await runHooks(
      on(
        "PermissionRequest",
        permission("no", "deny"),
        permission("yes", "allow"),
      ),
      permissionRequest(),
      dir,
    );
    expect(r.blocked).toBe(true);
    expect(r.permissionRequestDecision?.behavior).toBe("deny");
  });
});
