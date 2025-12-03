import {
  AgentFile,
  parseAgentFile,
  parseAgentFileTools,
  serializeAgentFile,
} from "./agentFiles.js";

const example = `
---
name: Example Agent / Agent File
description: Trying to wrap my head around what are these files
model: anthropic/claude-sonnet-4
tools: linear-mcp, sentry-mcp:read-alerts, Read, Glob, Bash(git diff:*)
rules: org/rule1, org/rule2
---
This is the prompt
`.trim();

const minimalExample = `
---
name: Minimal Agent File
---
Just a simple prompt
`.trim();

const invalidExample = `
---
description: Missing name field
---
This should fail
`.trim();

const noFrontmatterExample = `This is just markdown without frontmatter`;

const invalidYamlExample = `
---
name: [invalid: yaml: syntax
---
This should fail
`.trim();

describe("parseAgentFile", () => {
  test("parses complete agent file correctly", () => {
    const result = parseAgentFile(example);

    expect(result).toEqual({
      name: "Example Agent / Agent File",
      description: "Trying to wrap my head around what are these files",
      model: "anthropic/claude-sonnet-4",
      tools: "linear-mcp, sentry-mcp:read-alerts, Read, Glob, Bash(git diff:*)",
      rules: "org/rule1, org/rule2",
      prompt: "This is the prompt",
    });
  });

  test("parses minimal agent file with only name", () => {
    const result = parseAgentFile(minimalExample);

    expect(result).toEqual({
      name: "Minimal Agent File",
      prompt: "Just a simple prompt",
    });

    // Optional fields should be undefined
    expect(result.description).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.tools).toBeUndefined();
    expect(result.rules).toBeUndefined();
  });

  test("throws error when name field is missing", () => {
    expect(() => parseAgentFile(invalidExample)).toThrow(
      "Agent file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("throws error when no frontmatter is present", () => {
    expect(() => parseAgentFile(noFrontmatterExample)).toThrow(
      "Agent file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("throws error with invalid YAML syntax", () => {
    expect(() => parseAgentFile(invalidYamlExample)).toThrow();
  });

  test("handles empty frontmatter with name", () => {
    const emptyFrontmatter = `
---
name: Empty Test
---
`.trim();

    const result = parseAgentFile(emptyFrontmatter);
    expect(result).toEqual({
      name: "Empty Test",
      prompt: "",
    });
  });

  test("handles multiline prompts", () => {
    const multilineExample = `
---
name: Multiline Test
---
Line 1
Line 2

Line 4 with gap
`.trim();

    const result = parseAgentFile(multilineExample);
    expect(result.prompt).toBe("Line 1\nLine 2\n\nLine 4 with gap");
  });

  test("handles prompts with --- in content", () => {
    const dashedContentExample = `
---
name: Dashed Content
---
This has --- in the middle
And more content after
`.trim();

    const result = parseAgentFile(dashedContentExample);
    expect(result.prompt).toBe(
      "This has --- in the middle\nAnd more content after",
    );
  });

  test("validates unknown frontmatter fields are allowed", () => {
    const extraFieldsExample = `
---
name: Extra Fields Test
extraField: should be ignored by schema
---
Prompt content
`.trim();

    const result = parseAgentFile(extraFieldsExample);
    expect(result.name).toBe("Extra Fields Test");
    expect(result.prompt).toBe("Prompt content");
    // Extra fields should not be in the result
    expect("extraField" in result).toBe(false);
  });

  test("parses agent file with tools but no rules", () => {
    const toolsOnlyExample = `
---
name: Tools Only Agent File
description: An agent file that uses tools but no rules
tools: git, filesystem, search
---
This agent file uses tools but doesn't define any rules.
`.trim();

    const result = parseAgentFile(toolsOnlyExample);
    expect(result).toEqual({
      name: "Tools Only Agent File",
      description: "An agent file that uses tools but no rules",
      tools: "git, filesystem, search",
      prompt: "This agent file uses tools but doesn't define any rules.",
    });

    // Rules should be undefined
    expect(result.rules).toBeUndefined();
  });

  test("validates required name field type", () => {
    const invalidNameType = `
---
name: 123
---
Prompt
`.trim();

    expect(() => parseAgentFile(invalidNameType)).toThrow(
      "Invalid agent file frontmatter",
    );
  });
});

describe("serializeAgentFile", () => {
  test("serializes complete agent file correctly", () => {
    const agentFile: AgentFile = {
      name: "Test Agent File",
      description: "A test agent file",
      model: "anthropic/claude-sonnet-4-5",
      tools: "tool1, tool2",
      rules: "rule1, rule2",
      prompt: "This is the test prompt",
    };

    const result = serializeAgentFile(agentFile);

    // Parse it back to verify round-trip consistency
    const parsed = parseAgentFile(result);
    expect(parsed).toEqual(agentFile);
  });

  test("serializes minimal agent file", () => {
    const agentFile: AgentFile = {
      name: "Minimal",
      prompt: "Simple prompt",
    };

    const result = serializeAgentFile(agentFile);
    const parsed = parseAgentFile(result);
    expect(parsed).toEqual(agentFile);
  });

  test("filters out undefined values from frontmatter", () => {
    const agentFile: AgentFile = {
      name: "Test",
      description: undefined,
      model: "gpt-4",
      tools: undefined,
      rules: undefined,
      prompt: "Test prompt",
    };

    const result = serializeAgentFile(agentFile);

    // Should not contain undefined fields in YAML
    expect(result).not.toContain("description");
    expect(result).not.toContain("tools");
    expect(result).not.toContain("rules");
    expect(result).toContain("model: gpt-4");

    // Verify round-trip
    const parsed = parseAgentFile(result);
    expect(parsed.name).toBe("Test");
    expect(parsed.model).toBe("gpt-4");
    expect(parsed.description).toBeUndefined();
    expect(parsed.tools).toBeUndefined();
    expect(parsed.rules).toBeUndefined();
  });

  test("handles empty prompt", () => {
    const agentFile: AgentFile = {
      name: "Empty Prompt",
      prompt: "",
    };

    const result = serializeAgentFile(agentFile);
    const parsed = parseAgentFile(result);
    expect(parsed.prompt).toBe("");
  });

  test("preserves multiline prompts", () => {
    const agentFile: AgentFile = {
      name: "Multiline",
      prompt: "Line 1\nLine 2\n\nLine 4",
    };

    const result = serializeAgentFile(agentFile);
    const parsed = parseAgentFile(result);
    expect(parsed.prompt).toBe(agentFile.prompt);
  });
});

describe("round-trip consistency", () => {
  test("example agent file maintains consistency", () => {
    const parsed = parseAgentFile(example);
    const serialized = serializeAgentFile(parsed);
    const reparsed = parseAgentFile(serialized);

    expect(reparsed).toEqual(parsed);
  });

  test("minimal agent file maintains consistency", () => {
    const parsed = parseAgentFile(minimalExample);
    const serialized = serializeAgentFile(parsed);
    const reparsed = parseAgentFile(serialized);

    expect(reparsed).toEqual(parsed);
  });
});

describe("edge cases", () => {
  test("handles Windows line endings", () => {
    const windowsExample = example.replace(/\n/g, "\r\n");
    const result = parseAgentFile(windowsExample);

    expect(result.name).toBe("Example Agent / Agent File");
    expect(result.prompt).toBe("This is the prompt");
  });

  test("handles mixed line endings", () => {
    const mixedExample = `---\r\nname: Mixed\n---\r\nPrompt content\n`;
    const result = parseAgentFile(mixedExample);

    expect(result.name).toBe("Mixed");
    expect(result.prompt).toBe("Prompt content");
  });

  test("handles empty name string", () => {
    const emptyNameExample = `
---
name: ""
---
Prompt
`.trim();

    expect(() => parseAgentFile(emptyNameExample)).toThrow(
      "Agent file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("handles null name", () => {
    const nullNameExample = `
---
name: null
---
Prompt
`.trim();

    expect(() => parseAgentFile(nullNameExample)).toThrow(
      "Agent file must contain YAML frontmatter with a 'name' field",
    );
  });
});

describe("parseAgentFileTools", () => {
  it("should return empty arrays for undefined tools", () => {
    const result = parseAgentFileTools(undefined);
    expect(result).toEqual({ tools: [], mcpServers: [], allBuiltIn: false });
  });

  it("should return empty arrays for empty tools string", () => {
    const result = parseAgentFileTools("");
    expect(result).toEqual({ tools: [], mcpServers: [], allBuiltIn: false });

    const result2 = parseAgentFileTools("   ");
    expect(result2).toEqual({ tools: [], mcpServers: [], allBuiltIn: false });
  });

  it("should parse built-in tools", () => {
    const result = parseAgentFileTools("bash, read, edit");
    expect(result).toEqual({
      tools: [{ toolName: "bash" }, { toolName: "read" }, { toolName: "edit" }],
      mcpServers: [],
      allBuiltIn: false,
    });
  });

  it("should parse built_in keyword", () => {
    const result = parseAgentFileTools("built_in");
    expect(result).toEqual({
      tools: [],
      mcpServers: [],
      allBuiltIn: true,
    });
  });

  it("should parse built_in with other tools", () => {
    const result = parseAgentFileTools("built_in, owner/package");
    expect(result).toEqual({
      tools: [{ mcpServer: "owner/package" }],
      mcpServers: ["owner/package"],
      allBuiltIn: true,
    });
  });

  it("should parse MCP server (all tools)", () => {
    const result = parseAgentFileTools("owner/package, another/server");
    expect(result).toEqual({
      tools: [{ mcpServer: "owner/package" }, { mcpServer: "another/server" }],
      mcpServers: ["owner/package", "another/server"],
      allBuiltIn: false,
    });
  });

  it("should parse specific MCP tools", () => {
    const result = parseAgentFileTools(
      "owner/package:tool1, owner/package:tool2",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "owner/package", toolName: "tool1" },
        { mcpServer: "owner/package", toolName: "tool2" },
      ],
      mcpServers: ["owner/package"],
      allBuiltIn: false,
    });
  });

  it("should parse mixed tool types", () => {
    const result = parseAgentFileTools(
      "anmcp/serverslug:a_tool, anmcp/serverslug:another_tool, asecond/mcpserver, bash, read, edit",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "anmcp/serverslug", toolName: "a_tool" },
        { mcpServer: "anmcp/serverslug", toolName: "another_tool" },
        { mcpServer: "asecond/mcpserver" },
        { toolName: "bash" },
        { toolName: "read" },
        { toolName: "edit" },
      ],
      mcpServers: ["anmcp/serverslug", "asecond/mcpserver"],
      allBuiltIn: false,
    });
  });

  it("should parse mixed tools with built_in keyword", () => {
    const result = parseAgentFileTools(
      "built_in, anmcp/serverslug:a_tool, asecond/mcpserver",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "anmcp/serverslug", toolName: "a_tool" },
        { mcpServer: "asecond/mcpserver" },
      ],
      mcpServers: ["anmcp/serverslug", "asecond/mcpserver"],
      allBuiltIn: true,
    });
  });

  it("should deduplicate MCP servers", () => {
    const result = parseAgentFileTools(
      "owner/package:tool1, owner/package:tool2, owner/package, other/server",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "owner/package", toolName: "tool1" },
        { mcpServer: "owner/package", toolName: "tool2" },
        { mcpServer: "owner/package" },
        { mcpServer: "other/server" },
      ],
      mcpServers: ["owner/package", "other/server"],
      allBuiltIn: false,
    });
  });

  it("should handle extra whitespace", () => {
    const result = parseAgentFileTools(
      "  owner/package:tool1  ,   bash  ,  other/server  ",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "owner/package", toolName: "tool1" },
        { toolName: "bash" },
        { mcpServer: "other/server" },
      ],
      mcpServers: ["owner/package", "other/server"],
      allBuiltIn: false,
    });
  });

  it("should handle any MCP server slug format", () => {
    expect(() => parseAgentFileTools("invalid-slug")).not.toThrow();
    expect(() => parseAgentFileTools("invalid/slug/extra")).not.toThrow();
    expect(() =>
      parseAgentFileTools("owner/package:tool, invalid/slug/extra:tool"),
    ).not.toThrow();
  });

  it("should handle valid MCP server slug formats", () => {
    const validSlugs = [
      "owner/package",
      "owner-name/package-name",
      "owner.name/package.name",
      "owner_name/package_name",
      "owner123/package456",
    ];

    for (const slug of validSlugs) {
      expect(() => parseAgentFileTools(slug)).not.toThrow();
      expect(() => parseAgentFileTools(`${slug}:tool`)).not.toThrow();
    }
  });

  it("should handle empty tool names and empty entries", () => {
    const result = parseAgentFileTools(
      "owner/package:tool1, , owner/package:, bash",
    );
    expect(result).toEqual({
      tools: [
        { mcpServer: "owner/package", toolName: "tool1" },
        { mcpServer: "owner/package", toolName: "" },
        { toolName: "bash" },
      ],
      mcpServers: ["owner/package"],
      allBuiltIn: false,
    });
  });

  describe("URL-based MCP references", () => {
    it("should parse HTTPS URL without tool name", () => {
      const result = parseAgentFileTools("https://mcp.example.com");
      expect(result).toEqual({
        tools: [{ mcpServer: "https://mcp.example.com" }],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse HTTP URL without tool name", () => {
      const result = parseAgentFileTools("http://mcp.example.com");
      expect(result).toEqual({
        tools: [{ mcpServer: "http://mcp.example.com" }],
        mcpServers: ["http://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse HTTPS URL with port", () => {
      const result = parseAgentFileTools("https://mcp.example.com:8080");
      expect(result).toEqual({
        tools: [{ mcpServer: "https://mcp.example.com:8080" }],
        mcpServers: ["https://mcp.example.com:8080"],
        allBuiltIn: false,
      });
    });

    it("should parse HTTPS URL with tool name", () => {
      const result = parseAgentFileTools("https://mcp.example.com:tool_name");
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com", toolName: "tool_name" },
        ],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse HTTP URL with tool name", () => {
      const result = parseAgentFileTools("http://mcp.example.com:my_tool");
      expect(result).toEqual({
        tools: [{ mcpServer: "http://mcp.example.com", toolName: "my_tool" }],
        mcpServers: ["http://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse HTTPS URL with port and tool name", () => {
      const result = parseAgentFileTools(
        "https://mcp.example.com:8080:tool_name",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com:8080", toolName: "tool_name" },
        ],
        mcpServers: ["https://mcp.example.com:8080"],
        allBuiltIn: false,
      });
    });

    it("should parse URL with path", () => {
      const result = parseAgentFileTools("https://api.example.com/mcp");
      expect(result).toEqual({
        tools: [{ mcpServer: "https://api.example.com/mcp" }],
        mcpServers: ["https://api.example.com/mcp"],
        allBuiltIn: false,
      });
    });

    it("should parse URL with path and tool name", () => {
      const result = parseAgentFileTools(
        "https://api.example.com/mcp:tool_name",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://api.example.com/mcp", toolName: "tool_name" },
        ],
        mcpServers: ["https://api.example.com/mcp"],
        allBuiltIn: false,
      });
    });

    it("should parse URL with query parameters", () => {
      const result = parseAgentFileTools(
        "https://api.example.com/mcp?key=value",
      );
      expect(result).toEqual({
        tools: [{ mcpServer: "https://api.example.com/mcp?key=value" }],
        mcpServers: ["https://api.example.com/mcp?key=value"],
        allBuiltIn: false,
      });
    });

    it("should parse URL with query parameters and tool name", () => {
      const result = parseAgentFileTools(
        "https://api.example.com/mcp?key=value:tool_name",
      );
      expect(result).toEqual({
        tools: [
          {
            mcpServer: "https://api.example.com/mcp?key=value",
            toolName: "tool_name",
          },
        ],
        mcpServers: ["https://api.example.com/mcp?key=value"],
        allBuiltIn: false,
      });
    });

    it("should parse tool names with hyphens", () => {
      const result = parseAgentFileTools("https://mcp.example.com:read-alerts");
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com", toolName: "read-alerts" },
        ],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse tool names with mixed alphanumeric and special chars", () => {
      const result = parseAgentFileTools(
        "https://mcp.example.com:tool_name-123",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com", toolName: "tool_name-123" },
        ],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse multiple URL-based MCP references", () => {
      const result = parseAgentFileTools(
        "https://mcp1.example.com:tool1, https://mcp2.example.com:tool2",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp1.example.com", toolName: "tool1" },
          { mcpServer: "https://mcp2.example.com", toolName: "tool2" },
        ],
        mcpServers: ["https://mcp1.example.com", "https://mcp2.example.com"],
        allBuiltIn: false,
      });
    });

    it("should parse mixed URL and slug-based MCP references", () => {
      const result = parseAgentFileTools(
        "https://mcp.example.com:tool1, owner/package:tool2, bash",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com", toolName: "tool1" },
          { mcpServer: "owner/package", toolName: "tool2" },
          { toolName: "bash" },
        ],
        mcpServers: ["https://mcp.example.com", "owner/package"],
        allBuiltIn: false,
      });
    });

    it("should deduplicate URL-based MCP servers", () => {
      const result = parseAgentFileTools(
        "https://mcp.example.com:tool1, https://mcp.example.com:tool2, https://mcp.example.com",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://mcp.example.com", toolName: "tool1" },
          { mcpServer: "https://mcp.example.com", toolName: "tool2" },
          { mcpServer: "https://mcp.example.com" },
        ],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: false,
      });
    });

    it("should reject URL with whitespace in tool name", () => {
      expect(() =>
        parseAgentFileTools("https://mcp.example.com:tool name"),
      ).toThrow(
        'Invalid URL-based MCP tool reference "https://mcp.example.com:tool name": the part after the last colon must be either a port number or a valid tool name',
      );
    });

    it("should reject URL with invalid characters after colon", () => {
      expect(() =>
        parseAgentFileTools("https://mcp.example.com:invalid@tool"),
      ).toThrow(
        'Invalid URL-based MCP tool reference "https://mcp.example.com:invalid@tool": the part after the last colon must be either a port number or a valid tool name',
      );
    });

    it("should reject URL with whitespace before colon", () => {
      expect(() =>
        parseAgentFileTools("https://mcp.example.com :tool"),
      ).toThrow(
        'Invalid MCP tool reference "https://mcp.example.com :tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should handle URL-based MCP with built_in keyword", () => {
      const result = parseAgentFileTools(
        "built_in, https://mcp.example.com:tool1",
      );
      expect(result).toEqual({
        tools: [{ mcpServer: "https://mcp.example.com", toolName: "tool1" }],
        mcpServers: ["https://mcp.example.com"],
        allBuiltIn: true,
      });
    });

    it("should parse localhost URLs", () => {
      const result = parseAgentFileTools("http://localhost:3000");
      expect(result).toEqual({
        tools: [{ mcpServer: "http://localhost:3000" }],
        mcpServers: ["http://localhost:3000"],
        allBuiltIn: false,
      });
    });

    it("should parse localhost URLs with tool name", () => {
      const result = parseAgentFileTools("http://localhost:3000:my_tool");
      expect(result).toEqual({
        tools: [{ mcpServer: "http://localhost:3000", toolName: "my_tool" }],
        mcpServers: ["http://localhost:3000"],
        allBuiltIn: false,
      });
    });

    it("should parse IP address URLs", () => {
      const result = parseAgentFileTools("https://192.168.1.1:8080");
      expect(result).toEqual({
        tools: [{ mcpServer: "https://192.168.1.1:8080" }],
        mcpServers: ["https://192.168.1.1:8080"],
        allBuiltIn: false,
      });
    });

    it("should parse IP address URLs with tool name", () => {
      const result = parseAgentFileTools("https://192.168.1.1:8080:tool_name");
      expect(result).toEqual({
        tools: [
          { mcpServer: "https://192.168.1.1:8080", toolName: "tool_name" },
        ],
        mcpServers: ["https://192.168.1.1:8080"],
        allBuiltIn: false,
      });
    });
  });

  describe("whitespace validation in colon-separated MCP tool references", () => {
    it("should reject MCP tool reference with space after colon", () => {
      expect(() => parseAgentFileTools("owner/slug: tool")).toThrow(
        'Invalid MCP tool reference "owner/slug: tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with space before colon", () => {
      expect(() => parseAgentFileTools("owner/slug :tool")).toThrow(
        'Invalid MCP tool reference "owner/slug :tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with spaces around colon", () => {
      expect(() => parseAgentFileTools("owner/slug : tool")).toThrow(
        'Invalid MCP tool reference "owner/slug : tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with space in tool name", () => {
      expect(() => parseAgentFileTools("owner/slug:my tool")).toThrow(
        'Invalid MCP tool reference "owner/slug:my tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with space in server slug", () => {
      expect(() => parseAgentFileTools("owner /slug:tool")).toThrow(
        'Invalid MCP tool reference "owner /slug:tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with tab character", () => {
      expect(() => parseAgentFileTools("owner/slug:\ttool")).toThrow(
        'Invalid MCP tool reference "owner/slug:\ttool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with newline character", () => {
      expect(() => parseAgentFileTools("owner/slug:\ntool")).toThrow(
        'Invalid MCP tool reference "owner/slug:\ntool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with multiple spaces", () => {
      expect(() => parseAgentFileTools("owner/slug:  tool  ")).toThrow(
        'Invalid MCP tool reference "owner/slug:  tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should reject MCP tool reference with leading spaces in tool name", () => {
      expect(() => parseAgentFileTools("owner/slug:  tool")).toThrow(
        'Invalid MCP tool reference "owner/slug:  tool": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should accept valid colon-separated MCP tool reference without whitespace", () => {
      const result = parseAgentFileTools("owner/package:tool_name");
      expect(result).toEqual({
        tools: [{ mcpServer: "owner/package", toolName: "tool_name" }],
        mcpServers: ["owner/package"],
        allBuiltIn: false,
      });
    });

    it("should accept valid MCP tool references with hyphens and underscores", () => {
      const result = parseAgentFileTools(
        "owner-name/package_name:tool-name_123",
      );
      expect(result).toEqual({
        tools: [
          {
            mcpServer: "owner-name/package_name",
            toolName: "tool-name_123",
          },
        ],
        mcpServers: ["owner-name/package_name"],
        allBuiltIn: false,
      });
    });

    it("should allow whitespace between comma-separated items", () => {
      const result = parseAgentFileTools(
        "owner/package:tool1,   owner/package:tool2  ,  bash",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "owner/package", toolName: "tool1" },
          { mcpServer: "owner/package", toolName: "tool2" },
          { toolName: "bash" },
        ],
        mcpServers: ["owner/package"],
        allBuiltIn: false,
      });
    });

    it("should reject whitespace in one reference but accept valid references in same string", () => {
      expect(() =>
        parseAgentFileTools("owner/package:tool1, owner/package: tool2, bash"),
      ).toThrow(
        'Invalid MCP tool reference "owner/package: tool2": colon-separated tool references cannot contain whitespace',
      );
    });

    it("should not reject whitespace in MCP server references without colon", () => {
      // Note: This behavior may or may not be desired, but documents current behavior
      // Server-only references (no colon) don't trigger the whitespace check
      expect(() => parseAgentFileTools("owner /package")).not.toThrow();
    });

    it("should not reject whitespace in built-in tool names", () => {
      // Note: This behavior may or may not be desired, but documents current behavior
      // Built-in tools (no slash) don't trigger the whitespace check
      expect(() => parseAgentFileTools("my tool")).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty tool names correctly", () => {
      const result = parseAgentFileTools("owner/package:,https://example.com:");
      expect(result.tools).toEqual([
        { mcpServer: "owner/package", toolName: "" },
        { mcpServer: "https://example.com", toolName: "" },
      ]);
    });

    it("should handle trailing commas", () => {
      const result = parseAgentFileTools("bash, owner/package,");
      expect(result.tools).toEqual([
        { toolName: "bash" },
        { mcpServer: "owner/package" },
      ]);
    });

    it("should handle multiple consecutive commas", () => {
      const result = parseAgentFileTools("bash,,owner/package");
      expect(result.tools).toEqual([
        { toolName: "bash" },
        { mcpServer: "owner/package" },
      ]);
    });

    it("should parse complex real-world example", () => {
      const result = parseAgentFileTools(
        "built_in, linear/mcp, sentry/mcp:read-alerts, https://custom-mcp.internal.com:8443:custom_tool, bash",
      );
      expect(result).toEqual({
        tools: [
          { mcpServer: "linear/mcp" },
          { mcpServer: "sentry/mcp", toolName: "read-alerts" },
          {
            mcpServer: "https://custom-mcp.internal.com:8443",
            toolName: "custom_tool",
          },
          { toolName: "bash" },
        ],
        mcpServers: [
          "linear/mcp",
          "sentry/mcp",
          "https://custom-mcp.internal.com:8443",
        ],
        allBuiltIn: true,
      });
    });
  });
});
