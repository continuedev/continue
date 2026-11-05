/**
 * The hook service blocks, not waves through, an action it was meant to guard
 * when the hook machinery itself throws.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const runHooksMock = vi.fn();
vi.mock("./hookRunner.js", () => ({
  runHooks: (...args: unknown[]) => runHooksMock(...args),
}));
vi.mock("./hookConfig.js", () => ({
  loadHooksConfig: () => ({
    hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "x" }] }] },
    disabled: false,
  }),
}));

import { HookService } from "./HookService.js";
import type { HookInput } from "./types.js";

const base = { session_id: "s", transcript_path: "", cwd: "." };
const preToolUse: HookInput = {
  ...base,
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: {},
  tool_use_id: "t",
};
const postToolUse: HookInput = {
  ...base,
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: {},
  tool_response: "ok",
  tool_use_id: "t",
};

let service: HookService;
beforeEach(async () => {
  runHooksMock.mockReset();
  service = new HookService();
  await service.initialize();
});

describe("HookService.fireEvent when the runner throws", () => {
  it("blocks a PreToolUse and says hooks fail closed", async () => {
    runHooksMock.mockRejectedValue(new Error("boom"));
    const r = await service.fireEvent(preToolUse);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("boom");
    expect(r.blockReason).toContain("fail closed");
  });

  it("carries on for PostToolUse, which cannot undo anything", async () => {
    runHooksMock.mockRejectedValue(new Error("boom"));
    const r = await service.fireEvent(postToolUse);
    expect(r.blocked).toBe(false);
  });

  it("returns the runner's result when it works", async () => {
    runHooksMock.mockResolvedValue({ blocked: false, results: [] });
    expect((await service.fireEvent(preToolUse)).blocked).toBe(false);
  });
});
