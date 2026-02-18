import { describe, expect, it } from "@jest/globals";
import { AssistantUnrolled } from "../schemas/index.js";
import { mergeUnrolledAssistants } from "./merge.js";

describe("mergeUnrolledAssistants", () => {
  const createBaseConfig = (): AssistantUnrolled => ({
    name: "Base Assistant",
    version: "1.0.0",
    models: [
      {
        name: "gpt-4",
        model: "gpt-4",
        provider: "openai",
      },
    ],
    context: [
      {
        provider: "file",
      },
    ],
    rules: [
      {
        name: "typescript-style",
        rule: "Use TypeScript best practices",
      },
    ],
    prompts: [
      {
        name: "code-review",
        description: "Review code for best practices",
        prompt: "Please review this code",
      },
    ],
    docs: [
      {
        name: "api-docs",
        startUrl: "https://api.example.com/docs",
      },
    ],
    data: [
      {
        name: "user-data",
        destination: "memory",
        schema: "0.1.0",
      },
    ],
    mcpServers: [
      {
        name: "filesystem",
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        env: {
          ROOT_PATH: "/tmp",
        },
      },
    ],
    env: {
      API_KEY: "base-key",
    },
    requestOptions: {
      timeout: 5000,
      headers: {
        "X-Base": "value",
      },
    },
  });

  const createIncomingConfig = (): AssistantUnrolled => ({
    name: "Incoming Assistant",
    version: "1.1.0",
    models: [
      {
        name: "gpt-3.5-turbo",
        model: "gpt-3.5-turbo",
        provider: "openai",
      },
    ],
    context: [
      {
        provider: "git",
      },
    ],
    rules: [
      {
        name: "code-formatting",
        rule: "Use Prettier for code formatting",
      },
    ],
    prompts: [
      {
        name: "bug-fix",
        description: "Fix bugs in code",
        prompt: "Please fix the bug in this code",
      },
    ],
    docs: [
      {
        name: "user-guide",
        startUrl: "https://docs.example.com/guide",
      },
    ],
    data: [
      {
        name: "project-data",
        destination: "filesystem",
        schema: "0.1.0",
      },
    ],
    mcpServers: [
      {
        name: "git-server",
        command: "npx",
        args: ["@modelcontextprotocol/server-git"],
      },
    ],
    env: {
      API_TOKEN: "incoming-token",
      API_KEY: "incoming-key", // This will override base via object spread
    },
    requestOptions: {
      timeout: 3000,
      headers: {
        "X-Incoming": "value",
        "X-Base": "overridden",
      },
    },
  });

  it("should merge all block types without duplicates", () => {
    const base = createBaseConfig();
    const incoming = createIncomingConfig();
    const result = mergeUnrolledAssistants(base, incoming);

    // Should have models from both configs (incoming first due to priority)
    expect(result.models).toHaveLength(2);
    expect(result.models?.map((m) => m?.name)).toEqual([
      "gpt-3.5-turbo",
      "gpt-4",
    ]);

    // Should have context from both configs (incoming first due to priority)
    expect(result.context).toHaveLength(2);
    expect(result.context?.map((c) => c?.provider)).toEqual(["git", "file"]);

    // Should have rules from both configs (incoming first due to priority)
    expect(result.rules).toHaveLength(2);
    expect(
      result.rules?.map((r) => (typeof r === "string" ? r : r?.name)),
    ).toEqual(["code-formatting", "typescript-style"]);

    // Should have prompts from both configs (incoming first due to priority)
    expect(result.prompts).toHaveLength(2);
    expect(result.prompts?.map((p) => p?.name)).toEqual([
      "bug-fix",
      "code-review",
    ]);

    // Should have docs from both configs (incoming first due to priority)
    expect(result.docs).toHaveLength(2);
    expect(result.docs?.map((d) => d?.name)).toEqual([
      "user-guide",
      "api-docs",
    ]);

    // Should have data from both configs (incoming first due to priority)
    expect(result.data).toHaveLength(2);
    expect(result.data?.map((d) => d?.name)).toEqual([
      "project-data",
      "user-data",
    ]);

    // Should have mcpServers from both configs (incoming first due to priority)
    expect(result.mcpServers).toHaveLength(2);
    expect(result.mcpServers?.map((s) => s?.name)).toEqual([
      "git-server",
      "filesystem",
    ]);
  });

  it("should deduplicate models by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      models: [
        {
          name: "gpt-4", // Duplicate name
          model: "gpt-4",
          provider: "openai",
        },
        {
          name: "claude-3",
          model: "claude-3-sonnet-20240229",
          provider: "anthropic",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 models (incoming gpt-4 and incoming claude-3)
    expect(result.models).toHaveLength(2);
    expect(result.models?.map((m) => m?.name)).toEqual(["gpt-4", "claude-3"]);
    // Should keep the incoming version of gpt-4 (base version filtered as duplicate)
    expect(result.models?.[0]?.model).toBe("gpt-4");
  });

  it("should deduplicate context by provider", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      context: [
        {
          name: "file-context", // Different name but same provider
          provider: "file", // Same provider as base
        },
        {
          name: "terminal",
          provider: "terminal",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 context providers (incoming file and incoming terminal)
    expect(result.context).toHaveLength(2);
    expect(result.context?.map((c) => c?.provider)).toEqual([
      "file",
      "terminal",
    ]);
    // Should keep the incoming version of file provider (base version filtered as duplicate)
    expect(result.context?.[0]?.name).toBe("file-context");
  });

  it("should deduplicate rules by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      rules: [
        {
          name: "typescript-style", // Duplicate name
          rule: "Use different TypeScript practices",
        },
        {
          name: "naming-convention",
          rule: "Use camelCase for variables",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 rules (incoming typescript-style and incoming naming-convention)
    expect(result.rules).toHaveLength(2);
    expect(
      result.rules?.map((r) => (typeof r === "string" ? r : r?.name)),
    ).toEqual(["typescript-style", "naming-convention"]);
    // Should keep the incoming version of typescript-style (base version filtered as duplicate)
    const typescriptRule = result.rules?.[0] as any;
    expect(typescriptRule.rule).toBe("Use different TypeScript practices");
  });

  it("should deduplicate string rules", () => {
    const base: AssistantUnrolled = {
      name: "Base Assistant",
      version: "1.0.0",
      rules: ["Use semicolons", "Format with Prettier"],
    };

    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      rules: [
        "Use semicolons", // Duplicate
        "Use const instead of let",
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 3 unique rules (incoming first, then non-duplicates from base)
    expect(result.rules).toHaveLength(3);
    expect(result.rules).toEqual([
      "Use semicolons",
      "Use const instead of let",
      "Format with Prettier",
    ]);
  });

  it("should deduplicate prompts by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      prompts: [
        {
          name: "code-review", // Duplicate name
          description: "Different review process",
          prompt: "Different review prompt",
        },
        {
          name: "documentation",
          description: "Generate documentation",
          prompt: "Create docs for this code",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 prompts (incoming code-review and incoming documentation)
    expect(result.prompts).toHaveLength(2);
    expect(result.prompts?.map((p) => p?.name)).toEqual([
      "code-review",
      "documentation",
    ]);
    // Should keep the incoming version of code-review (base version filtered as duplicate)
    expect(result.prompts?.[0]?.description).toBe("Different review process");
  });

  it("should deduplicate docs by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      docs: [
        {
          name: "api-docs", // Duplicate name
          startUrl: "https://different-api.example.com/docs",
        },
        {
          name: "tutorials",
          startUrl: "https://tutorials.example.com",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 docs (incoming api-docs and incoming tutorials)
    expect(result.docs).toHaveLength(2);
    expect(result.docs?.map((d) => d?.name)).toEqual(["api-docs", "tutorials"]);
    // Should keep the incoming version of api-docs (base version filtered as duplicate)
    expect(result.docs?.[0]?.startUrl).toBe(
      "https://different-api.example.com/docs",
    );
  });

  it("should deduplicate data by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      data: [
        {
          name: "user-data", // Duplicate name
          destination: "different-provider",
          schema: "0.1.0",
        },
        {
          name: "system-data",
          destination: "system",
          schema: "0.1.0",
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 data sources (incoming user-data and incoming system-data)
    expect(result.data).toHaveLength(2);
    expect(result.data?.map((d) => d?.name)).toEqual([
      "user-data",
      "system-data",
    ]);
    // Should keep the incoming version of user-data (base version filtered as duplicate)
    expect(result.data?.[0]?.destination).toBe("different-provider");
  });

  it("should deduplicate mcpServers by name", () => {
    const base = createBaseConfig();
    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      mcpServers: [
        {
          name: "filesystem", // Duplicate name
          command: "different-command",
          args: ["different-args"],
        },
        {
          name: "database",
          command: "db-server",
          args: ["--port", "5432"],
        },
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should only have 2 MCP servers (incoming filesystem and incoming database)
    expect(result.mcpServers).toHaveLength(2);
    expect(result.mcpServers?.map((s) => s?.name)).toEqual([
      "filesystem",
      "database",
    ]);
    // Should keep the incoming version of filesystem (base version filtered as duplicate)
    const firstMcpServer = result.mcpServers?.[0];
    if (firstMcpServer && "command" in firstMcpServer) {
      expect(firstMcpServer.command).toBe("different-command");
    }
  });

  it("should handle null values in arrays", () => {
    const base: AssistantUnrolled = {
      name: "Base Assistant",
      version: "1.0.0",
      models: [
        null,
        {
          name: "gpt-4",
          model: "gpt-4",
          provider: "openai",
        },
      ],
    };

    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      models: [
        {
          name: "claude-3",
          model: "claude-3-sonnet-20240229",
          provider: "anthropic",
        },
        null,
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    // Should filter out null values and have only 2 models (incoming first due to priority)
    expect(result.models).toHaveLength(2);
    expect(result.models?.map((m) => m?.name)).toEqual(["claude-3", "gpt-4"]);
  });

  it("should merge env variables with incoming overriding base", () => {
    const base = createBaseConfig();
    const incoming = createIncomingConfig();
    const result = mergeUnrolledAssistants(base, incoming);

    expect(result.env).toEqual({
      API_KEY: "incoming-key", // Should be overridden by incoming
      API_TOKEN: "incoming-token", // New from incoming
    });
  });

  it("should merge requestOptions correctly", () => {
    const base = createBaseConfig();
    const incoming = createIncomingConfig();
    const result = mergeUnrolledAssistants(base, incoming);

    expect(result.requestOptions).toEqual({
      timeout: 5000, // Base overrides incoming
      headers: {
        "X-Base": "value", // Base overrides incoming in headers too
        "X-Incoming": "value", // New from incoming
      },
    });
  });

  it("should handle empty arrays and undefined fields", () => {
    const base: AssistantUnrolled = {
      name: "Base Assistant",
      version: "1.0.0",
      models: [],
      context: undefined,
    };

    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      models: [
        {
          name: "gpt-4",
          model: "gpt-4",
          provider: "openai",
        },
      ],
      rules: [],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    expect(result.models).toHaveLength(1);
    expect(result.models?.[0]?.name).toBe("gpt-4");
    expect(result.context).toBeUndefined();
    expect(result.rules).toBeUndefined();
  });

  it("should preserve name and version from base config", () => {
    const base = createBaseConfig();
    const incoming = createIncomingConfig();
    const result = mergeUnrolledAssistants(base, incoming);

    expect(result.name).toBe("Base Assistant");
    expect(result.version).toBe("1.0.0");
  });

  it("should handle complex deduplication scenario with mixed types", () => {
    const base: AssistantUnrolled = {
      name: "Base Assistant",
      version: "1.0.0",
      rules: [
        "Simple rule 1",
        {
          name: "complex-rule",
          rule: "Complex rule description",
        },
        "Simple rule 2",
      ],
    };

    const incoming: AssistantUnrolled = {
      name: "Incoming Assistant",
      version: "1.1.0",
      rules: [
        "Simple rule 1", // Duplicate
        {
          name: "complex-rule", // Duplicate by name
          rule: "Different complex rule description",
        },
        {
          name: "new-complex-rule",
          rule: "New complex rule",
        },
        "Simple rule 3",
      ],
    };

    const result = mergeUnrolledAssistants(base, incoming);

    expect(result.rules).toHaveLength(5); // 4 incoming + 1 from base (2 duplicates filtered)
    expect(result.rules).toEqual([
      "Simple rule 1", // From incoming (base duplicate filtered)
      {
        name: "complex-rule",
        rule: "Different complex rule description", // Should keep incoming version
      },
      {
        name: "new-complex-rule",
        rule: "New complex rule",
      },
      "Simple rule 3",
      "Simple rule 2", // From base (only non-duplicate left)
    ]);
  });
});
