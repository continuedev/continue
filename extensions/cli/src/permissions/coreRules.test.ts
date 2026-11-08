import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { describe, expect, it, vi } from "vitest";

import {
  evaluateWithCoreRules,
  setAutoReviewEnabled,
  toCoreCall,
  reviewerModel,
} from "./coreRules.js";

const bashCheck = (base: any, args: Record<string, unknown>) =>
  evaluateTerminalCommandSecurity(base, args.command as string);

const run = (
  command: string,
  over: Partial<Parameters<typeof evaluateWithCoreRules>[0]> = {},
) =>
  evaluateWithCoreRules({
    cliToolName: "Bash",
    args: { command },
    cliPermission: "allow",
    evaluateToolCallPolicy: bashCheck,
    assistantPermissions: { deny: [], ask: [], allow: [] },
    isHeadless: false,
    ...over,
  });

const stubReviewer = (reply: string | Error) =>
  ({
    chat: vi.fn(async () => {
      if (reply instanceof Error) throw reply;
      return { role: "assistant", content: reply };
    }),
  }) as any;

describe("toCoreCall", () => {
  it("maps the CLI tools to the names and arguments the rules use", () => {
    expect(toCoreCall("Bash", { command: "ls" })).toEqual({
      toolName: "run_terminal_command",
      parsedArgs: { command: "ls" },
    });
    expect(toCoreCall("Read", { filepath: "a" })?.toolName).toBe("read_file");
    expect(toCoreCall("Write", { filepath: "a" })?.toolName).toBe(
      "create_new_file",
    );
    expect(toCoreCall("Edit", { file_path: "a" })).toEqual({
      toolName: "edit_existing_file",
      parsedArgs: { filepath: "a" },
    });
    expect(toCoreCall("MultiEdit", { file_path: "a" })?.parsedArgs).toEqual({
      filepath: "a",
    });
    expect(toCoreCall("List", { dirpath: "d" })?.parsedArgs).toEqual({
      dirPath: "d",
    });
    expect(toCoreCall("Fetch", { url: "u" })?.toolName).toBe(
      "fetch_url_content",
    );
    expect(toCoreCall("Search", { pattern: "p" })?.parsedArgs).toEqual({
      query: "p",
    });
  });
  it("has no mapping for MCP and other tools", () => {
    expect(toCoreCall("some_mcp_tool", {})).toBeUndefined();
  });
});

describe("rules from config.yaml in the CLI", () => {
  it("does not apply without rules or a reviewer", async () => {
    expect(
      await run("ls", { assistantPermissions: undefined }),
    ).toBeUndefined();
  });

  it("does not apply to a tool core has no name for", async () => {
    expect(
      await run("x", { cliToolName: "mcp_thing", args: {} }),
    ).toBeUndefined();
  });

  it("a deny rule refuses even when the CLI policy allows", async () => {
    const v = await run("terraform apply", {
      assistantPermissions: { deny: ["runTerminalCommand(terraform apply*)"] },
    });
    expect(v).toMatchObject({ decision: "deny", by: "rules" });
    expect(v?.reason).toContain("terraform apply");
  });

  it("a protected path turns an allowed command into an ask", async () => {
    expect(await run("cat .env")).toMatchObject({
      decision: "ask",
      by: "rules",
    });
  });

  it("an ask rule turns an allowed command into an ask", async () => {
    const v = await run("git push", {
      assistantPermissions: { ask: ["runTerminalCommand(git push*)"] },
    });
    expect(v?.decision).toBe("ask");
  });

  it("an allow rule lets through what the CLI policy would ask about", async () => {
    const v = await run("npm run build", {
      cliPermission: "ask",
      assistantPermissions: { allow: ["runTerminalCommand(npm run build)"] },
    });
    expect(v?.decision).toBe("allow");
  });

  it("an allow rule does not beat a deny rule or a protected path", async () => {
    expect(
      (
        await run("cat .env", {
          cliPermission: "ask",
          assistantPermissions: { allow: ["runTerminalCommand(cat .env)"] },
        })
      )?.decision,
    ).toBe("ask");
    expect(
      (
        await run("rm -rf build", {
          assistantPermissions: {
            allow: ["runTerminalCommand(rm -rf build)"],
            deny: ["runTerminalCommand(rm *)"],
          },
        })
      )?.decision,
    ).toBe("deny");
  });

  it("the safety floor still refuses a command the CLI policy allows", async () => {
    expect((await run("rm -rf /"))?.decision).toBe("deny");
  });

  it("file rules use the CLI Read tool's path", async () => {
    const v = await evaluateWithCoreRules({
      cliToolName: "Read",
      args: { filepath: "secrets/key.txt" },
      cliPermission: "allow",
      assistantPermissions: { deny: ["readFile(secrets/**)"] },
      isHeadless: true,
    });
    expect(v?.decision).toBe("deny");
  });
});

describe("the Auto reviewer in the CLI (--auto-review)", () => {
  const allow = JSON.stringify({ decision: "allow", reason: "Runs tests." });
  const deny = JSON.stringify({
    decision: "deny",
    category: "production-impact",
    reason: "Targets prod.",
  });

  const auto = (command: string, reviewer: any, over: object = {}) =>
    run(command, {
      cliPermission: "ask",
      autoReview: true,
      reviewer,
      assistantPermissions: undefined,
      ...over,
    });

  it("lets the reviewer allow a call that is left open", async () => {
    const r = stubReviewer(allow);
    const v = await auto("npm run build", r);
    expect(v).toMatchObject({ decision: "allow", by: "reviewer" });
    expect(r.chat).toHaveBeenCalledTimes(1);
  });

  it("lets the reviewer refuse with its reason", async () => {
    const v = await auto("make deploy", stubReviewer(deny));
    expect(v).toMatchObject({ decision: "deny", by: "reviewer" });
    expect(v?.reason).toContain("prod");
  });

  it("never asks the reviewer about a deny rule, protected path or ask rule", async () => {
    const r = stubReviewer(allow);
    expect(
      (
        await auto("terraform apply", r, {
          assistantPermissions: {
            deny: ["runTerminalCommand(terraform apply*)"],
          },
        })
      )?.decision,
    ).toBe("deny");
    expect((await auto("cat .env", r))?.decision).toBe("ask");
    expect(
      (
        await auto("git push", r, {
          assistantPermissions: { ask: ["runTerminalCommand(git push*)"] },
        })
      )?.decision,
    ).toBe("ask");
    expect(r.chat).not.toHaveBeenCalled();
  });

  it("headless: a missing reviewer model refuses instead of asking", async () => {
    const v = await auto("make build", null, { isHeadless: true });
    expect(v?.decision).toBe("deny");
    expect(v?.reason).toMatch(/reviewer/i);
  });

  it("headless: a failing reviewer refuses; interactive it asks", async () => {
    const headless = await auto("make build", stubReviewer(new Error("down")), {
      isHeadless: true,
    });
    expect(headless?.decision).toBe("deny");
    const interactive = await auto(
      "make build2",
      stubReviewer(new Error("down")),
    );
    expect(interactive?.decision).toBe("ask");
  });

  it("an unreadable reply is never an allow", async () => {
    const v = await auto("make build3", stubReviewer("sure, go ahead"));
    expect(v?.decision).not.toBe("allow");
  });

  it("applies with a reviewer even when config.yaml has no rules", async () => {
    const v = await auto("npm test", stubReviewer(allow));
    expect(v?.decision).toBe("allow");
  });
});

describe("--auto-review flag state", () => {
  it("is off by default and can be set", async () => {
    const m = await import("./coreRules.js");
    expect(m.isAutoReviewEnabled()).toBe(false);
    setAutoReviewEnabled(true);
    expect(m.isAutoReviewEnabled()).toBe(true);
    setAutoReviewEnabled(false);
  });
});

describe("reviewerModel", () => {
  const judge = {
    name: "Judge",
    provider: "openai",
    model: "gpt-4.1-mini",
    roles: ["reviewer"],
  };
  const chat = {
    name: "Chat",
    provider: "openai",
    model: "gpt-4.1",
    roles: ["chat"],
  };

  it("prefers the model modeModels.reviewer names, whatever its roles", () => {
    const assistant = {
      models: [chat, judge],
      modeModels: { reviewer: { model: "Chat" } },
    } as any;
    expect(reviewerModel(assistant)?.name).toBe("Chat");
  });

  it("falls back to the first reviewer-role model, also for an unknown name", () => {
    expect(reviewerModel({ models: [chat, judge] } as any)?.name).toBe("Judge");
    expect(
      reviewerModel({
        models: [chat, judge],
        modeModels: { reviewer: { model: "Nope" } },
      } as any)?.name,
    ).toBe("Judge");
    expect(reviewerModel({ models: [chat] } as any)).toBeUndefined();
  });
});
