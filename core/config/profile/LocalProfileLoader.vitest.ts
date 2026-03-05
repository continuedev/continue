/**
 * Defensive tests for Bug 3 (GitHub Issue: TBD):
 * "Local Config" display name is hardcoded — ignores config.yaml `name` field.
 *
 * The default local profile (no overrideAssistantFile) always shows
 * "Local Config" regardless of the `name` field in config.yaml.
 * Project-level agent files DO read the name from the file content.
 *
 * The FAILING test (now PASSING after fix) verifies that the default
 * profile reads its name from the primary config file.
 */
import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocalProfileLoader from "./LocalProfileLoader";

// Minimal stubs — LocalProfileLoader only uses IDE/ControlPlaneClient/ILLMLogger
// in doLoadConfig(), not in the constructor where the title is set.
const stubIde = {} as any;
const stubControlPlane = {} as any;
const stubLogger = {} as any;

describe("LocalProfileLoader title resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Defensive test for Bug 3.
   *
   * The fix reads the primary config file in the constructor and extracts
   * the `name` field via parseConfigYaml(). We mock fs to provide a
   * config with a custom name, ensuring this works in CI too.
   */
  it("default profile should read title from primary config file", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      "name: My Custom Config\nversion: 1.0.0\nschema: v1\nmodels: []",
    );

    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
    );
    // FAILS before fix: constructor hardcodes "Local Config"
    // PASSES after fix: constructor reads name from config file
    expect(loader.description.title).toBe("My Custom Config");
  });

  it("default profile should fall back to 'Local Config' when config file is missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
    );
    expect(loader.description.title).toBe("Local Config");
  });

  // --- Passing tests below document working behavior ---

  it("should read name from file content for project-level agent files", () => {
    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
      {
        path: "file:///workspace/.continue/agents/my-agent.yaml",
        content: `name: My Custom Agent\nversion: 1.0.0\nschema: v1\nmodels: []`,
      },
    );
    expect(loader.description.title).toBe("My Custom Agent");
  });

  it("should fall back to filename when content fails to parse", () => {
    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
      {
        path: "file:///workspace/.continue/agents/broken.yaml",
        content: "not: valid: yaml: [[[",
      },
    );
    // Falls back to getUriPathBasename of the path
    expect(loader.description.title).toBe("broken.yaml");
  });

  it("default profile should use 'local' as id", () => {
    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
    );
    expect(loader.description.id).toBe("local");
  });

  it("project-level profile should use file path as id", () => {
    const agentPath = "file:///workspace/.continue/agents/my-agent.yaml";
    const loader = new LocalProfileLoader(
      stubIde,
      stubControlPlane,
      stubLogger,
      {
        path: agentPath,
        content: `name: My Agent\nversion: 1.0.0\nschema: v1\nmodels: []`,
      },
    );
    expect(loader.description.id).toBe(agentPath);
  });
});
