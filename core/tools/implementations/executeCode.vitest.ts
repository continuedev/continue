import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinueError } from "../../util/errors";
import { __TEST_ONLY, executeCodeImpl } from "./executeCode";

vi.mock("@e2b/code-interpreter", () => {
  class MockSandbox {
    static create = vi.fn(async () => new MockSandbox());
    static instances: MockSandbox[] = [];
    static createdCount = 0;
    sandboxId: string;
    commands = { run: vi.fn().mockResolvedValue(undefined) };
    files = {
      write: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue(""),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    constructor() {
      MockSandbox.createdCount += 1;
      this.sandboxId = `sandbox-${MockSandbox.createdCount}`;
      MockSandbox.instances.push(this);
    }
    runCode = vi.fn().mockResolvedValue({
      logs: { stdout: ["ok"], stderr: [] },
      results: [{ text: "42" }],
    });
    kill = vi.fn().mockResolvedValue(undefined);
  }
  return { Sandbox: MockSandbox };
});

vi.mock("../../context/mcp/MCPManagerSingleton", () => {
  const manager = {
    connections: new Map(),
    getStatuses: () => [],
  };
  return {
    MCPManagerSingleton: {
      getInstance: () => manager,
    },
  };
});

const baseExtras = {
  ide: {} as any,
  llm: {} as any,
  fetch: vi.fn(),
  tool: {
    function: {
      name: "execute_code",
      description: "",
      parameters: {},
    },
    readonly: false,
    type: "function",
    group: "Built-In",
    displayTitle: "Execute Code",
  },
  config: {
    experimental: {
      codeExecution: {
        enabled: true,
        e2bApiKey: "test-key",
      },
    },
  },
  conversationId: "conversation-test",
} as any;

const buildExtras = (overrides: Partial<typeof baseExtras> = {}) => ({
  ...baseExtras,
  ...overrides,
  config: {
    ...baseExtras.config,
    ...(overrides.config ?? {}),
    experimental: {
      ...baseExtras.config.experimental,
      ...(overrides.config?.experimental ?? {}),
      codeExecution: {
        ...baseExtras.config.experimental.codeExecution,
        ...(overrides.config?.experimental?.codeExecution ?? {}),
      },
    },
  },
});

const clearSessions = async () => {
  await __TEST_ONLY.clearSessions();
};

describe("executeCodeImpl", () => {
  const originalEnv = process.env.E2B_API_KEY;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { Sandbox } = await import("@e2b/code-interpreter");
    (Sandbox as any).instances = [];
    (Sandbox as any).createdCount = 0;
    (Sandbox.create as any).mockClear();
    process.env.E2B_API_KEY = originalEnv;
    await clearSessions();
  });

  afterEach(async () => {
    process.env.E2B_API_KEY = originalEnv;
    await clearSessions();
  });

  it("throws when feature disabled", async () => {
    const extras = buildExtras({
      config: { experimental: { codeExecution: { enabled: false } } },
    });
    await expect(
      executeCodeImpl({ code: "console.log('hi')" }, extras),
    ).rejects.toThrow(ContinueError);
  });

  it("throws when API key missing", async () => {
    const extras = buildExtras();
    extras.config.experimental.codeExecution.e2bApiKey = undefined;
    delete process.env.E2B_API_KEY;
    await expect(
      executeCodeImpl({ code: "console.log('hello')" }, extras),
    ).rejects.toThrow(/E2B API key/);
  });

  it("returns context items when execution succeeds", async () => {
    const extras = buildExtras();
    const result = await executeCodeImpl({ code: "console.log('ok')" }, extras);
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("ok");
  });

  it("reuses sandbox for the same conversation", async () => {
    const extras = buildExtras();
    await executeCodeImpl({ code: "console.log('first')" }, extras);
    await executeCodeImpl({ code: "console.log('second')" }, extras);
    const { Sandbox } = await import("@e2b/code-interpreter");
    expect(Sandbox.create).toHaveBeenCalledTimes(1);
  });

  it("enforces rate limits", async () => {
    const extras = buildExtras({
      config: {
        experimental: {
          codeExecution: {
            enabled: true,
            e2bApiKey: "test",
            rateLimit: { maxExecutionsPerMinute: 1 },
          },
        },
      },
    });

    await executeCodeImpl({ code: "1 + 1" }, extras);
    await expect(executeCodeImpl({ code: "2 + 2" }, extras)).rejects.toThrow(
      /rate limit/i,
    );
  });

  it("propagates execution errors", async () => {
    const extras = buildExtras();
    const { Sandbox } = await import("@e2b/code-interpreter");
    (Sandbox.create as any).mockImplementationOnce(async () => {
      const instance = new (Sandbox as any)();
      instance.runCode = vi.fn().mockRejectedValue(new Error("sandbox failed"));
      return instance;
    });
    await expect(
      executeCodeImpl({ code: "throw new Error('boom')" }, extras),
    ).rejects.toThrow(/sandbox failed/);
  });

  it("passes timeout settings to the sandbox", async () => {
    const extras = buildExtras({
      config: {
        experimental: {
          codeExecution: {
            enabled: true,
            e2bApiKey: "key",
            maxExecutionTimeSeconds: 5,
            requestTimeoutSeconds: 15,
          },
        },
      },
    });
    await executeCodeImpl({ code: "console.log('timing')" }, extras);
    const { Sandbox } = await import("@e2b/code-interpreter");
    const instance = (Sandbox as any).instances[0];
    expect(instance.runCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeoutMs: 5000, requestTimeoutMs: 15000 }),
    );
  });
});
