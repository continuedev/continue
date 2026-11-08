import { describe, expect, test, vi } from "vitest";

vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: { getInstance: vi.fn() },
}));

import { mcpToolIsReadOnly } from "./doLoadConfig";

const WORKSPACE = ["file:///repo"];
const readOnly = { annotations: { readOnlyHint: true } };

describe("believing an MCP tool's read-only mark", () => {
  test("from a server in the person's own config", () => {
    expect(
      mcpToolIsReadOnly(
        readOnly,
        "file:///home/me/.continue/config.yaml",
        WORKSPACE,
      ),
    ).toBe(true);
    expect(mcpToolIsReadOnly(readOnly, undefined, WORKSPACE)).toBe(true);
  });

  test("not from a server the open repository brought", () => {
    expect(
      mcpToolIsReadOnly(
        readOnly,
        "file:///repo/.continue/mcpServers/a.yaml",
        WORKSPACE,
      ),
    ).toBe(false);
  });

  test("a tool with no mark is never read-only", () => {
    expect(mcpToolIsReadOnly({}, undefined, WORKSPACE)).toBe(false);
    expect(
      mcpToolIsReadOnly(
        { annotations: { readOnlyHint: false } },
        undefined,
        WORKSPACE,
      ),
    ).toBe(false);
  });
});
