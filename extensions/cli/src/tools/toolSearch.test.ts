import { describe, expect, it, vi } from "vitest";

const getAllAvailableTools = vi.fn(async () => [
  {
    name: "Grep",
    description: "Search file contents with ripgrep",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "TodoWrite",
    description: "Update a structured todo list",
    parameters: { type: "object", properties: {} },
  },
]);

vi.mock("./index.js", () => ({
  getAllAvailableTools,
}));

vi.mock("../services/index.js", () => ({
  services: {
    mcp: {
      getState: () => ({ tools: [] }),
    },
  },
}));

import { toolSearchTool } from "./toolSearch.js";

describe("toolSearchTool", () => {
  it("returns ranked keyword matches", async () => {
    const result = await toolSearchTool.run({ query: "grep" });

    expect(result).toContain("Found 1 tool(s)");
    expect(result).toContain("Grep: Search file contents with ripgrep");
  });

  it("returns exact schema details for select queries", async () => {
    const result = await toolSearchTool.run({ query: "select:TodoWrite" });

    expect(result).toContain("TodoWrite");
    expect(result).toContain("Update a structured todo list");
    expect(getAllAvailableTools).toHaveBeenCalled();
  });
});
