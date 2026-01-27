import * as fs from "fs";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  categorizeModels,
  createModelEntry,
  diffModels,
  filterModels,
  formatAsJson,
  generateConfig,
  getContinueHome,
  getConfigPath,
  getEnvPath,
  getProviderPreset,
  getSectionsInfo,
  listBackups,
  loadConfig,
  MODIFIED_SECTIONS,
  PRESERVED_SECTIONS,
  readApiKeyFromEnv,
  restoreBackup,
  validateConfigStructure,
} from "./configModels.js";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  copyFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

describe("configModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getContinueHome", () => {
    it("should return custom path when provided", () => {
      expect(getContinueHome("/custom/path")).toBe("/custom/path");
    });

    it("should return CONTINUE_HOME env var when set", () => {
      const originalEnv = process.env.CONTINUE_HOME;
      process.env.CONTINUE_HOME = "/env/continue";
      expect(getContinueHome()).toBe("/env/continue");
      process.env.CONTINUE_HOME = originalEnv;
    });

    it("should return default ~/.continue when no override", () => {
      const originalEnv = process.env.CONTINUE_HOME;
      delete process.env.CONTINUE_HOME;
      const result = getContinueHome();
      expect(result).toContain(".continue");
      process.env.CONTINUE_HOME = originalEnv;
    });
  });

  describe("getConfigPath", () => {
    it("should return config.yaml path", () => {
      const continueHome = path.join("/home", "user", ".continue");
      expect(getConfigPath(continueHome)).toBe(
        path.join(continueHome, "config.yaml"),
      );
    });
  });

  describe("getEnvPath", () => {
    it("should return .env path", () => {
      const continueHome = path.join("/home", "user", ".continue");
      expect(getEnvPath(continueHome)).toBe(path.join(continueHome, ".env"));
    });
  });

  describe("readApiKeyFromEnv", () => {
    it("should return null when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBeNull();
    });

    it("should parse API key without quotes", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("API_KEY=test-key-123\n");
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBe("test-key-123");
    });

    it("should parse API key with double quotes", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('API_KEY="quoted-key"\n');
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBe("quoted-key");
    });

    it("should parse API key with single quotes", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("API_KEY='single-quoted'\n");
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBe("single-quoted");
    });

    it("should return null when key not found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("OTHER_KEY=value\n");
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBeNull();
    });

    it("should handle multiple keys and find the right one", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "OTHER_KEY=other\nAPI_KEY=correct\nANOTHER=another\n",
      );
      expect(readApiKeyFromEnv("/path/.env", "API_KEY")).toBe("correct");
    });
  });

  describe("loadConfig", () => {
    it("should return null when config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadConfig("/path/config.yaml")).toBeNull();
    });

    it("should parse valid YAML config", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
version: 1.0.0
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
`);
      const config = loadConfig("/path/config.yaml");
      expect(config).not.toBeNull();
      expect(config?.name).toBe("Test Config");
      expect(config?.version).toBe("1.0.0");
      expect((config?.models as unknown[])?.length).toBe(1);
    });
  });

  describe("categorizeModels", () => {
    it("should categorize chat models", () => {
      const result = categorizeModels(["gpt-4", "claude-3", "llama-70b"]);
      expect(result.chat).toEqual(["claude-3", "gpt-4", "llama-70b"]);
      expect(result.embed).toEqual([]);
      expect(result.rerank).toEqual([]);
    });

    it("should categorize embedding models", () => {
      const result = categorizeModels([
        "text-embedding-ada-002",
        "BAAI/bge-m3",
      ]);
      expect(result.embed).toEqual(["BAAI/bge-m3", "text-embedding-ada-002"]);
      expect(result.chat).toEqual([]);
    });

    it("should categorize reranking models", () => {
      const result = categorizeModels(["BAAI/bge-reranker-v2-m3"]);
      expect(result.rerank).toEqual(["BAAI/bge-reranker-v2-m3"]);
      expect(result.chat).toEqual([]);
      expect(result.embed).toEqual([]);
    });

    it("should handle mixed models", () => {
      const result = categorizeModels([
        "gpt-4",
        "text-embedding-ada-002",
        "BAAI/bge-reranker-v2-m3",
        "claude-3",
      ]);
      expect(result.chat).toEqual(["claude-3", "gpt-4"]);
      expect(result.embed).toEqual(["text-embedding-ada-002"]);
      expect(result.rerank).toEqual(["BAAI/bge-reranker-v2-m3"]);
    });
  });

  describe("validateConfigStructure", () => {
    it("should return error when name is missing", () => {
      const errors = validateConfigStructure({
        models: [{ model: "gpt-4", provider: "openai" }],
      });
      expect(errors).toContain("Missing required field: name");
    });

    it("should return error when models is empty", () => {
      const errors = validateConfigStructure({ name: "Test", models: [] });
      expect(errors).toContain("No models defined");
    });

    it("should return error when models is missing", () => {
      const errors = validateConfigStructure({ name: "Test" });
      expect(errors).toContain("No models defined");
    });

    it("should return error when model is missing model field", () => {
      const errors = validateConfigStructure({
        name: "Test",
        models: [{ provider: "openai" }],
      });
      expect(errors).toContain("Model 0: missing 'model' field");
    });

    it("should return error when model is missing provider field", () => {
      const errors = validateConfigStructure({
        name: "Test",
        models: [{ model: "gpt-4" }],
      });
      expect(errors).toContain("Model 0: missing 'provider' field");
    });

    it("should return empty array for valid config", () => {
      const errors = validateConfigStructure({
        name: "Test",
        models: [{ model: "gpt-4", provider: "openai" }],
      });
      expect(errors).toEqual([]);
    });

    it("should validate multiple models", () => {
      const errors = validateConfigStructure({
        name: "Test",
        models: [
          { model: "gpt-4", provider: "openai" },
          { provider: "anthropic" }, // missing model
          { model: "claude-3" }, // missing provider
        ],
      });
      expect(errors).toContain("Model 1: missing 'model' field");
      expect(errors).toContain("Model 2: missing 'provider' field");
    });
  });

  describe("getSectionsInfo", () => {
    it("should count array sections", () => {
      const config = {
        name: "Test",
        version: "1.0.0",
        models: [{ model: "gpt-4" }, { model: "claude-3" }],
        mcpServers: [{ name: "server1" }],
        rules: [],
      };
      const result = getSectionsInfo(config);
      expect(result.sections.models).toBe(2);
      expect(result.sections.mcpServers).toBe(1);
      expect(result.sections.rules).toBe(0);
    });

    it("should extract metadata fields", () => {
      const config = {
        name: "My Config",
        version: "2.0.0",
        schema: "v1",
        models: [],
      };
      const result = getSectionsInfo(config);
      expect(result.metadata.name).toBe("My Config");
      expect(result.metadata.version).toBe("2.0.0");
      expect(result.metadata.schema).toBe("v1");
    });
  });

  describe("createModelEntry", () => {
    it("should create basic model entry", () => {
      const entry = createModelEntry(
        "gpt-4",
        "https://api.openai.com/v1",
        "${{ secrets.OPENAI_API_KEY }}",
      );
      expect(entry.name).toBe("gpt-4");
      expect(entry.provider).toBe("openai");
      expect(entry.model).toBe("gpt-4");
      expect(entry.apiKey).toBe("${{ secrets.OPENAI_API_KEY }}");
      expect(entry.apiBase).toBe("https://api.openai.com/v1");
    });

    it("should extract name from model path", () => {
      const entry = createModelEntry(
        "meta-llama/Llama-4-Maverick-17B",
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
      );
      expect(entry.name).toBe("Llama-4-Maverick-17B");
      expect(entry.model).toBe("meta-llama/Llama-4-Maverick-17B");
    });

    it("should add roles when provided", () => {
      const entry = createModelEntry(
        "text-embedding-ada-002",
        "https://api.openai.com/v1",
        "${{ secrets.API_KEY }}",
        undefined,
        ["embed"],
      );
      expect(entry.roles).toEqual(["embed"]);
    });

    it("should add custom auth header when not Authorization", () => {
      const entry = createModelEntry(
        "gpt-4",
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
        "x-api-key",
      );
      expect(entry.requestOptions?.headers?.["x-api-key"]).toBe(
        "${{ secrets.API_KEY }}",
      );
    });

    it("should not add requestOptions for standard Authorization header", () => {
      const entry = createModelEntry(
        "gpt-4",
        "https://api.openai.com/v1",
        "${{ secrets.API_KEY }}",
        "Authorization",
      );
      expect(entry.requestOptions).toBeUndefined();
    });
  });

  describe("PRESERVED_SECTIONS", () => {
    it("should contain all expected preserved sections", () => {
      expect(PRESERVED_SECTIONS).toContain("name");
      expect(PRESERVED_SECTIONS).toContain("version");
      expect(PRESERVED_SECTIONS).toContain("mcpServers");
      expect(PRESERVED_SECTIONS).toContain("rules");
      expect(PRESERVED_SECTIONS).toContain("prompts");
      expect(PRESERVED_SECTIONS).toContain("context");
      expect(PRESERVED_SECTIONS).toContain("data");
      expect(PRESERVED_SECTIONS).toContain("docs");
    });

    it("should not contain models", () => {
      expect(PRESERVED_SECTIONS).not.toContain("models");
    });
  });

  describe("MODIFIED_SECTIONS", () => {
    it("should only contain models", () => {
      expect(MODIFIED_SECTIONS).toEqual(["models"]);
    });
  });

  // ============================================================
  // NEW FEATURE TESTS - TDD
  // ============================================================

  describe("addModelToConfig", () => {
    it("should add a model to an existing config", async () => {
      const { addModelToConfig, loadConfigDocument } = await import(
        "./configModels.js"
      );

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
`);

      const result = await addModelToConfig(
        "/path/config.yaml",
        "claude-3",
        "https://api.anthropic.com/v1",
        "${{ secrets.ANTHROPIC_API_KEY }}",
      );

      expect(result.added).toBe(true);
      expect(result.modelId).toBe("claude-3");
    });

    it("should not add duplicate model", async () => {
      const { addModelToConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
`);

      const result = await addModelToConfig(
        "/path/config.yaml",
        "gpt-4",
        "https://api.openai.com/v1",
        "${{ secrets.API_KEY }}",
      );

      expect(result.added).toBe(false);
      expect(result.reason).toContain("already exists");
    });

    it("should add model with custom name", async () => {
      const { addModelToConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models: []
`);

      const result = await addModelToConfig(
        "/path/config.yaml",
        "meta-llama/Llama-3-70B",
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
        { name: "My Llama" },
      );

      expect(result.added).toBe(true);
      expect(result.name).toBe("My Llama");
    });

    it("should add model with roles", async () => {
      const { addModelToConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models: []
`);

      const result = await addModelToConfig(
        "/path/config.yaml",
        "text-embedding-ada-002",
        "https://api.openai.com/v1",
        "${{ secrets.API_KEY }}",
        { roles: ["embed"] },
      );

      expect(result.added).toBe(true);
      expect(result.roles).toEqual(["embed"]);
    });
  });

  describe("removeModelFromConfig", () => {
    it("should remove an existing model", async () => {
      const { removeModelFromConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
  - name: claude-3
    provider: anthropic
    model: claude-3
`);

      const result = await removeModelFromConfig("/path/config.yaml", "gpt-4");

      expect(result.removed).toBe(true);
      expect(result.modelId).toBe("gpt-4");
    });

    it("should return false for non-existent model", async () => {
      const { removeModelFromConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
`);

      const result = await removeModelFromConfig(
        "/path/config.yaml",
        "nonexistent-model",
      );

      expect(result.removed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("should support dry-run mode", async () => {
      const { removeModelFromConfig } = await import("./configModels.js");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
`);

      const result = await removeModelFromConfig("/path/config.yaml", "gpt-4", {
        dryRun: true,
      });

      expect(result.removed).toBe(true);
      expect(result.dryRun).toBe(true);
      // Should not have written to file
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
    });
  });

  describe("generateConfig", () => {
    it("should generate config with all available models", async () => {
      const { generateConfig } = await import("./configModels.js");

      const result = await generateConfig(
        ["gpt-4", "claude-3", "text-embedding-ada-002"],
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
        { name: "Generated Config" },
      );

      expect(result.name).toBe("Generated Config");
      expect(result.models).toHaveLength(3);
    });

    it("should filter to chat models only", async () => {
      const result = await generateConfig(
        ["gpt-4", "claude-3", "text-embedding-ada-002", "BAAI/bge-reranker-v2"],
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
        { chatOnly: true },
      );

      const models = result.models as any[];
      expect(models).toHaveLength(2);
      // Results are sorted alphabetically
      expect(models.map((m: any) => m.model)).toEqual(["claude-3", "gpt-4"]);
    });

    it("should filter to embed models only", async () => {
      const result = await generateConfig(
        ["gpt-4", "text-embedding-ada-002", "BAAI/bge-m3"],
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
        { embedOnly: true },
      );

      const models = result.models as any[];
      expect(models).toHaveLength(2);
      expect(models.every((m: any) => m.roles?.includes("embed"))).toBe(true);
    });

    it("should assign correct roles based on model type", async () => {
      const result = await generateConfig(
        ["gpt-4", "text-embedding-ada-002", "BAAI/bge-reranker-v2-m3"],
        "https://api.example.com/v1",
        "${{ secrets.API_KEY }}",
      );

      const models = result.models as any[];
      const chatModel = models.find((m: any) => m.model === "gpt-4");
      const embedModel = models.find(
        (m: any) => m.model === "text-embedding-ada-002",
      );
      const rerankModel = models.find(
        (m: any) => m.model === "BAAI/bge-reranker-v2-m3",
      );

      expect(chatModel?.roles).toEqual(["chat"]);
      expect(embedModel?.roles).toEqual(["embed"]);
      expect(rerankModel?.roles).toEqual(["rerank"]);
    });
  });

  describe("diffModels", () => {
    it("should show models in config but not available", () => {
      const result = diffModels(
        ["gpt-4", "claude-3", "old-model"],
        ["gpt-4", "claude-3", "new-model"],
      );

      expect(result.inConfigNotAvailable).toEqual(["old-model"]);
      expect(result.availableNotInConfig).toEqual(["new-model"]);
      expect(result.inBoth).toEqual(["claude-3", "gpt-4"]);
    });

    it("should return empty arrays when everything matches", () => {
      const result = diffModels(["gpt-4", "claude-3"], ["gpt-4", "claude-3"]);

      expect(result.inConfigNotAvailable).toEqual([]);
      expect(result.availableNotInConfig).toEqual([]);
      expect(result.inBoth).toEqual(["claude-3", "gpt-4"]);
    });
  });

  describe("listBackups", () => {
    it("should list backup files", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "config.yaml",
        "config.backup-2024-01-15T10-30-00.yaml",
        "config.backup-2024-01-16T14-45-00.yaml",
        "other-file.txt",
      ] as any);

      const result = listBackups("/home/user/.continue");

      expect(result).toHaveLength(2);
      expect(result[0]).toContain("backup-2024-01-16");
      expect(result[1]).toContain("backup-2024-01-15");
    });

    it("should return empty array when no backups exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["config.yaml"] as any);

      const result = listBackups("/home/user/.continue");

      expect(result).toEqual([]);
    });
  });

  describe("restoreBackup", () => {
    it("should restore from a backup file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("backup content");

      const result = restoreBackup(
        "/home/user/.continue",
        "config.backup-2024-01-15T10-30-00.yaml",
      );

      expect(result.restored).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it("should fail for non-existent backup", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = restoreBackup(
        "/home/user/.continue",
        "nonexistent-backup.yaml",
      );

      expect(result.restored).toBe(false);
      expect(result.reason).toContain("not found");
    });
  });

  describe("getProviderPreset", () => {
    it("should return OpenAI preset", () => {
      const preset = getProviderPreset("openai");

      expect(preset?.apiBase).toBe("https://api.openai.com/v1");
      expect(preset?.authHeader).toBe("Authorization");
      expect(preset?.apiKeyEnv).toBe("OPENAI_API_KEY");
    });

    it("should return Anthropic preset", () => {
      const preset = getProviderPreset("anthropic");

      expect(preset?.apiBase).toBe("https://api.anthropic.com/v1");
      expect(preset?.authHeader).toBe("x-api-key");
      expect(preset?.apiKeyEnv).toBe("ANTHROPIC_API_KEY");
    });

    it("should return Azure preset", () => {
      const preset = getProviderPreset("azure");

      expect(preset?.authHeader).toBe("api-key");
      expect(preset?.apiKeyEnv).toBe("AZURE_API_KEY");
    });

    it("should return Ollama preset", () => {
      const preset = getProviderPreset("ollama");

      expect(preset?.apiBase).toBe("http://localhost:11434/v1");
      expect(preset?.requiresApiKey).toBe(false);
    });

    it("should return null for unknown provider", () => {
      const preset = getProviderPreset("unknown-provider");

      expect(preset).toBeNull();
    });
  });

  describe("filterModels", () => {
    it("should filter by pattern", () => {
      const models = ["gpt-4", "gpt-3.5-turbo", "claude-3", "llama-70b"];
      const result = filterModels(models, { pattern: "gpt" });

      expect(result).toEqual(["gpt-4", "gpt-3.5-turbo"]);
    });

    it("should filter chat models only", () => {
      const models = ["gpt-4", "text-embedding-ada-002", "BAAI/bge-reranker"];
      const result = filterModels(models, { chatOnly: true });

      expect(result).toEqual(["gpt-4"]);
    });

    it("should filter embed models only", () => {
      const models = ["gpt-4", "text-embedding-ada-002", "BAAI/bge-m3"];
      const result = filterModels(models, { embedOnly: true });

      expect(result).toEqual(["BAAI/bge-m3", "text-embedding-ada-002"]);
    });

    it("should filter rerank models only", () => {
      const models = ["gpt-4", "BAAI/bge-reranker-v2-m3", "text-embedding"];
      const result = filterModels(models, { rerankOnly: true });

      expect(result).toEqual(["BAAI/bge-reranker-v2-m3"]);
    });

    it("should combine pattern with type filter", () => {
      const models = [
        "gpt-4",
        "gpt-3.5-turbo",
        "text-embedding-gpt",
        "claude-3",
      ];
      const result = filterModels(models, { pattern: "gpt", chatOnly: true });

      // Results are sorted alphabetically
      expect(result).toEqual(["gpt-3.5-turbo", "gpt-4"]);
    });
  });

  describe("formatAsJson", () => {
    it("should format verify result as JSON", () => {
      const result = formatAsJson("verify", {
        available: ["gpt-4"],
        unavailable: ["old-model"],
        configModels: ["gpt-4", "old-model"],
      });

      const parsed = JSON.parse(result);
      expect(parsed.command).toBe("verify");
      expect(parsed.data.available).toEqual(["gpt-4"]);
    });

    it("should format list result as JSON", () => {
      const result = formatAsJson("list", {
        models: ["gpt-4", "claude-3"],
        categories: { chat: ["gpt-4", "claude-3"], embed: [], rerank: [] },
      });

      const parsed = JSON.parse(result);
      expect(parsed.command).toBe("list");
      expect(parsed.data.models).toEqual(["gpt-4", "claude-3"]);
    });
  });
});
