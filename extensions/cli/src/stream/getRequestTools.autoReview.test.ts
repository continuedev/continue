import { beforeEach, describe, expect, it, vi } from "vitest";

import { setAutoReviewEnabled } from "../permissions/coreRules.js";

const tools = vi.hoisted(() => [
  { name: "Read", description: "", parameters: {} },
  { name: "Bash", description: "", parameters: {} },
]);

vi.mock("../tools/index.js", () => ({
  getAllAvailableTools: vi.fn(async () => tools),
  convertToolToChatCompletionTool: (t: any) => ({ function: { name: t.name } }),
}));
vi.mock("../services/index.js", () => ({
  SERVICE_NAMES: { TOOL_PERMISSIONS: "toolPermissions" },
  serviceContainer: {
    get: vi.fn(async () => ({
      permissions: {
        policies: [
          { tool: "Read", permission: "allow" },
          { tool: "Bash", permission: "ask" },
        ],
      },
    })),
  },
  services: {},
}));

import { getRequestTools } from "./handleToolCalls.js";

const names = (r: any[]) => r.map((t) => t.function.name);

beforeEach(() => setAutoReviewEnabled(false));

describe("getRequestTools in headless mode", () => {
  it("does not offer tools that ask, as before", async () => {
    expect(names(await getRequestTools(true))).toEqual(["Read"]);
  });

  it("offers them with --auto-review, where the reviewer answers", async () => {
    setAutoReviewEnabled(true);
    expect(names(await getRequestTools(true))).toEqual(["Read", "Bash"]);
  });

  it("interactive runs offer them either way", async () => {
    expect(names(await getRequestTools(false))).toEqual(["Read", "Bash"]);
  });
});
