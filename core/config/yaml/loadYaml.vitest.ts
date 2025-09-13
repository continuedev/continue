import {
  AssistantUnrolledNonNullable,
  PackageIdentifier,
  validateConfigYaml,
} from "@continuedev/config-yaml";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LLMLogger } from "../../llm/logger";
import { testControlPlaneClient, testIde } from "../../test/fixtures";
import {
  addToTestDir,
  setUpTestDir,
  tearDownTestDir,
  TEST_DIR_PATH,
} from "../../test/testDir";
import { localPathToUri } from "../../util/pathToUri";
import { loadContinueConfigFromYaml } from "./loadYaml";

describe("MCP Server cwd configuration", () => {
  describe("YAML schema validation", () => {
    it("should accept valid MCP server with cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "node",
            args: ["server.js"],
            env: { NODE_ENV: "production" },
            cwd: "/path/to/project",
            connectionTimeout: 5000,
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept MCP server without cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "python",
            args: ["-m", "server"],
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept relative paths in cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "cargo",
            args: ["run"],
            cwd: "./rust-project",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });

    it("should accept empty string cwd", () => {
      const config: AssistantUnrolledNonNullable = {
        name: "test-agent",
        version: "1.0.0",
        mcpServers: [
          {
            name: "test-server",
            command: "deno",
            args: ["run", "server.ts"],
            cwd: "",
          },
        ],
      };

      const errors = validateConfigYaml(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe("MCP server configuration examples", () => {
    it("should support common MCP server patterns with cwd", () => {
      const configs = [
        {
          name: "Local project MCP server",
          server: {
            name: "project-mcp",
            command: "npm",
            args: ["run", "mcp-server"],
            cwd: "/Users/developer/my-project",
          },
        },
        {
          name: "Python MCP with virtual environment",
          server: {
            name: "python-mcp",
            command: "python",
            args: ["-m", "my_mcp_server"],
            env: { PYTHONPATH: "./src" },
            cwd: "/home/user/python-project",
          },
        },
        {
          name: "Relative path MCP server",
          server: {
            name: "relative-mcp",
            command: "node",
            args: ["index.js"],
            cwd: "../mcp-servers/filesystem",
          },
        },
      ];

      configs.forEach(({ name, server }) => {
        const config: AssistantUnrolledNonNullable = {
          name: "test-agent",

          version: "1.0.0",
          mcpServers: [server],
        };

        const errors = validateConfigYaml(config);
        expect(errors).toHaveLength(0);
      });
    });
  });
});

describe("loadContinueConfigFromYaml local file block uses", () => {
  beforeEach(() => {
    setUpTestDir();
  });

  afterEach(() => {
    tearDownTestDir();
  });

  it("resolves file:// path uses in rules", async () => {
    addToTestDir([
      "config.yaml",
      [
        "blocks/rules.yaml",
        "name: Rules\n" +
          "version: 0.0.1\n" +
          "schema: v1\n" +
          "\n" +
          "rules:\n" +
          "  - Be humble\n",
      ],
    ]);

    const absBlockPath = path.join(TEST_DIR_PATH, "blocks", "rules.yaml");

    const overrideConfigYaml: any = {
      name: "Test Assistant",
      version: "0.0.1",
      rules: [{ uses: localPathToUri(absBlockPath) }],
    };

    const pkg: PackageIdentifier = {
      uriType: "file",
      fileUri: localPathToUri(path.join(TEST_DIR_PATH, "config.yaml")),
    };

    const result = await loadContinueConfigFromYaml({
      ide: testIde,
      ideSettings: await testIde.getIdeSettings(),
      ideInfo: await testIde.getIdeInfo(),
      uniqueId: await testIde.getUniqueId(),
      llmLogger: new LLMLogger(),
      workOsAccessToken: await testControlPlaneClient.getAccessToken(),
      overrideConfigYaml,
      controlPlaneClient: testControlPlaneClient,
      orgScopeId: null,
      packageIdentifier: pkg,
    });

    expect(result.configLoadInterrupted).toBe(false);
    expect(result.config).toBeTruthy();
    const rules = result.config!.rules.map((r) => r.rule);
    expect(rules).toContain("Be humble");
  });
});
