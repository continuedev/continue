import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";

const { mockGetStatuses, mockGetConnection, mockReadResource } = vi.hoisted(
  () => ({
    mockGetStatuses: vi.fn(),
    mockGetConnection: vi.fn(),
    mockReadResource: vi.fn(),
  }),
);

vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: () => ({
      getStatuses: mockGetStatuses,
      getConnection: mockGetConnection,
    }),
  },
}));

import {
  listMcpResourcesImpl,
  mcpAuthImpl,
  readMcpResourceImpl,
} from "./mcpTools";

function createExtras(): ToolExtras {
  return {
    ide: {} as any,
    llm: {} as any,
    fetch: (() => {
      throw new Error("unused");
    }) as any,
    tool: {} as any,
    config: {} as any,
  } as ToolExtras;
}

describe("mcp tools", () => {
  beforeEach(() => {
    mockGetStatuses.mockReset();
    mockGetConnection.mockReset();
    mockReadResource.mockReset();
  });

  it("lists resources across matching servers", async () => {
    mockGetStatuses.mockReturnValue([
      {
        id: "github-cloud",
        name: "GitHub Cloud",
        type: "sse",
        url: "https://example.com/sse",
        status: "connected",
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        tools: [],
        resources: [
          { uri: "repo://issues", name: "Issues" },
          { uri: "repo://prs" },
        ],
        resourceTemplates: [],
      },
    ]);

    const result = await listMcpResourcesImpl({}, createExtras());

    expect(result[0]?.content).toBe(
      "GitHub Cloud: repo://issues (Issues)\nGitHub Cloud: repo://prs",
    );
  });

  it("reads a text MCP resource from a matching server", async () => {
    mockGetStatuses.mockReturnValue([
      {
        id: "github-cloud",
        name: "GitHub Cloud",
        type: "sse",
        url: "https://example.com/sse",
        status: "connected",
        errors: [],
        infos: [],
        isProtectedResource: false,
        prompts: [],
        tools: [],
        resources: [{ uri: "repo://issues", name: "Issues" }],
        resourceTemplates: [],
      },
    ]);
    mockReadResource.mockResolvedValue({
      contents: [
        { uri: "repo://issues", mimeType: "text/plain", text: "Issue body" },
      ],
    });
    mockGetConnection.mockReturnValue({ getResource: mockReadResource });

    const result = await readMcpResourceImpl(
      { uri: "repo://issues" },
      createExtras(),
    );

    expect(mockGetConnection).toHaveBeenCalledWith("github-cloud");
    expect(result[0]?.content).toBe("Issue body");
  });

  it("reports auth and connection status details", async () => {
    mockGetStatuses.mockReturnValue([
      {
        id: "github-cloud",
        name: "GitHub Cloud",
        type: "sse",
        url: "https://example.com/sse",
        status: "connected",
        errors: [],
        infos: ["oauth configured"],
        isProtectedResource: true,
        prompts: [{}],
        tools: [{}, {}],
        resources: [{}],
        resourceTemplates: [],
      },
    ]);

    const result = await mcpAuthImpl({}, createExtras());

    expect(result[0]?.content).toBe(
      "GitHub Cloud: status=connected tools=2 prompts=1 resources=1 protected_resource=true infos=oauth configured",
    );
  });
});
