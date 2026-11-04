import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setAutoReviewEnabled } from "../permissions/coreRules.js";

const state = vi.hoisted(() => ({
  model: { assistant: undefined as any, authConfig: {} as any },
}));

vi.mock("../services/index.js", () => ({
  SERVICE_NAMES: { MODEL: "model", TOOL_PERMISSIONS: "toolPermissions" },
  serviceContainer: {
    get: vi.fn(async () => state.model),
    getSync: vi.fn(() => ({ value: state.model })),
  },
  services: { chatHistory: { getHistory: () => [] } },
}));

// eslint-disable-next-line import/order
import { checkToolPermissionApproval } from "./streamChatResponse.helpers.js";

const bash = (command: string): any => ({
  id: "1",
  name: "Bash",
  arguments: { command },
  argumentsStr: JSON.stringify({ command }),
  tool: {
    evaluateToolCallPolicy: (base: any, args: any) =>
      evaluateTerminalCommandSecurity(base, args.command),
  },
});

const allowAll = { policies: [{ tool: "*", permission: "allow" as const }] };
const askAll = { policies: [{ tool: "*", permission: "ask" as const }] };
const excludeBash = {
  policies: [{ tool: "Bash", permission: "exclude" as const }],
};

beforeEach(() => {
  state.model = { assistant: undefined, authConfig: {} };
  setAutoReviewEnabled(false);
});

describe("checkToolPermissionApproval with toolPermissions rules", () => {
  it("is unchanged when config.yaml has no toolPermissions", async () => {
    // The default headless policy allows Bash; `cat .env` still runs, as before.
    expect(
      await checkToolPermissionApproval(allowAll, bash("cat .env"), {}, true),
    ).toEqual({ approved: true });
  });

  it("a deny rule refuses and the message names the rule", async () => {
    state.model.assistant = {
      toolPermissions: { deny: ["runTerminalCommand(terraform apply*)"] },
    };
    const r = await checkToolPermissionApproval(
      allowAll,
      bash("terraform apply"),
      {},
      true,
    );
    expect(r.approved).toBe(false);
    expect(r.denialReason).toBe("policy");
    expect(r.denialMessage).toContain("terraform apply");
  });

  it("headless: a protected path (an ask) is refused, not prompted", async () => {
    state.model.assistant = { toolPermissions: {} };
    const r = await checkToolPermissionApproval(
      allowAll,
      bash("cat .env"),
      {},
      true,
    );
    expect(r).toMatchObject({ approved: false, denialReason: "policy" });
    expect(r.denialMessage).toMatch(/headless/i);
  });

  it("headless: an ask rule is refused", async () => {
    state.model.assistant = {
      toolPermissions: { ask: ["runTerminalCommand(git push*)"] },
    };
    const r = await checkToolPermissionApproval(
      allowAll,
      bash("git push"),
      {},
      true,
    );
    expect(r).toMatchObject({ approved: false, denialReason: "policy" });
  });

  it("interactive: an ask goes to the user (denied here, no prompt callback)", async () => {
    state.model.assistant = {
      toolPermissions: { ask: ["runTerminalCommand(git push*)"] },
    };
    const r = await checkToolPermissionApproval(
      allowAll,
      bash("git push"),
      {},
      false,
    );
    expect(r).toMatchObject({ approved: false, denialReason: "user" });
  });

  it("an allow rule runs a call the CLI policy would ask about", async () => {
    state.model.assistant = {
      toolPermissions: { allow: ["runTerminalCommand(npm run build)"] },
    };
    expect(
      await checkToolPermissionApproval(
        askAll,
        bash("npm run build"),
        {},
        true,
      ),
    ).toEqual({ approved: true });
  });

  it("the CLI's own exclude is never loosened by an allow rule", async () => {
    state.model.assistant = {
      toolPermissions: { allow: ["runTerminalCommand(npm run build)"] },
    };
    const r = await checkToolPermissionApproval(
      excludeBash,
      bash("npm run build"),
      {},
      true,
    );
    expect(r).toMatchObject({ approved: false, denialReason: "policy" });
  });
});

describe("checkToolPermissionApproval with --auto-review", () => {
  it("headless without a reviewer model refuses a call the rules leave open", async () => {
    setAutoReviewEnabled(true);
    state.model.assistant = { models: [{ provider: "openai", model: "m" }] };
    const r = await checkToolPermissionApproval(
      askAll,
      bash("npm run build"),
      {},
      true,
    );
    expect(r).toMatchObject({ approved: false, denialReason: "policy" });
    expect(r.denialMessage).toMatch(/reviewer/i);
  });

  it("a deny rule still wins", async () => {
    setAutoReviewEnabled(true);
    state.model.assistant = {
      toolPermissions: { deny: ["runTerminalCommand(make deploy*)"] },
    };
    const r = await checkToolPermissionApproval(
      allowAll,
      bash("make deploy"),
      {},
      true,
    );
    expect(r.approved).toBe(false);
    expect(r.denialMessage).toContain("make deploy");
  });
});
