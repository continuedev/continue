import * as fs from "fs";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs module before importing the module under test
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  getContinueHome,
  getConfigPath,
  loadConfig,
  getSectionsInfo,
  validateConfigStructure,
  PRESERVED_SECTIONS,
} from "./configModels.js";

describe("config command integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("config sections display", () => {
    it("should correctly identify preserved vs modified sections", () => {
      // Verify PRESERVED_SECTIONS contains all expected sections
      const expectedPreserved = [
        "name",
        "version",
        "schema",
        "mcpServers",
        "rules",
        "prompts",
        "context",
        "data",
        "docs",
      ];

      for (const section of expectedPreserved) {
        expect(PRESERVED_SECTIONS).toContain(section);
      }

      // Verify models is NOT in preserved sections
      expect(PRESERVED_SECTIONS).not.toContain("models");
    });

    it("should count sections correctly in getSectionsInfo", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
name: Test Config
version: 1.0.0
schema: v1
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
  - name: claude-3
    provider: anthropic
    model: claude-3
mcpServers:
  - name: brave-search
    command: npx
  - name: github
    command: npx
  - name: puppeteer
    command: npx
rules:
  - Always be helpful
prompts: []
context: []
`);

      const config = loadConfig("/path/config.yaml");
      expect(config).not.toBeNull();

      const { sections, metadata } = getSectionsInfo(config!);

      expect(sections.models).toBe(2);
      expect(sections.mcpServers).toBe(3);
      expect(sections.rules).toBe(1);
      expect(sections.prompts).toBe(0);
      expect(sections.context).toBe(0);

      expect(metadata.name).toBe("Test Config");
      expect(metadata.version).toBe("1.0.0");
      expect(metadata.schema).toBe("v1");
    });
  });

  describe("config validation", () => {
    it("should validate a complete config", () => {
      const config = {
        name: "Valid Config",
        version: "1.0.0",
        models: [
          { name: "gpt-4", provider: "openai", model: "gpt-4" },
          { name: "claude-3", provider: "anthropic", model: "claude-3" },
        ],
        mcpServers: [{ name: "brave-search", command: "npx" }],
      };

      const errors = validateConfigStructure(config);
      expect(errors).toEqual([]);
    });

    it("should report multiple validation errors", () => {
      const config = {
        // missing name
        models: [
          { provider: "openai" }, // missing model
          { model: "claude-3" }, // missing provider
        ],
      };

      const errors = validateConfigStructure(config);
      expect(errors).toContain("Missing required field: name");
      expect(errors).toContain("Model 0: missing 'model' field");
      expect(errors).toContain("Model 1: missing 'provider' field");
    });
  });

  describe("continue home detection", () => {
    it("should use custom path when provided", () => {
      expect(getContinueHome("/custom/path")).toBe("/custom/path");
    });

    it("should use CONTINUE_HOME env var when set", () => {
      const original = process.env.CONTINUE_HOME;
      process.env.CONTINUE_HOME = "/env/path";
      expect(getContinueHome()).toBe("/env/path");
      process.env.CONTINUE_HOME = original;
    });

    it("should default to ~/.continue", () => {
      const original = process.env.CONTINUE_HOME;
      delete process.env.CONTINUE_HOME;
      const result = getContinueHome();
      expect(result).toContain(".continue");
      process.env.CONTINUE_HOME = original;
    });
  });

  describe("config path resolution", () => {
    it("should construct correct config path", () => {
      // Use path.join for cross-platform compatibility (Windows uses backslashes)
      const continueHome = path.join("/home", "user", ".continue");
      expect(getConfigPath(continueHome)).toBe(
        path.join(continueHome, "config.yaml"),
      );
    });
  });
});
