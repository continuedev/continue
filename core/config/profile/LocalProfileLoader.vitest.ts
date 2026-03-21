import { describe, expect, it, vi } from "vitest";
import fs from "fs";

import { ControlPlaneClient } from "../../control-plane/client.js";
import { LLMLogger } from "../../llm/logger.js";
import { testIde } from "../../test/fixtures.js";
import LocalProfileLoader from "./LocalProfileLoader.js";

// Mock doLoadConfig to capture the arguments it receives
const mockDoLoadConfig = vi.fn().mockResolvedValue({
  config: undefined,
  errors: [],
  configLoadInterrupted: false,
});

vi.mock("./doLoadConfig.js", () => ({
  default: (...args: any[]) => mockDoLoadConfig(...args),
}));

const mockParseConfigYaml = vi.fn();
vi.mock("@continuedev/config-yaml", async () => {
  const actual = await vi.importActual<object>("@continuedev/config-yaml");
  return {
    ...actual,
    parseConfigYaml: (...args: any[]) => mockParseConfigYaml(...args),
  };
});

describe("LocalProfileLoader", () => {
  const controlPlaneClient = new ControlPlaneClient(
    Promise.resolve(undefined),
    testIde,
  );
  const llmLogger = new LLMLogger();

  it("should pass pre-read content in packageIdentifier for override files", async () => {
    const overrideFile = {
      path: "vscode-remote://wsl+Ubuntu/home/user/.continue/agents/test.yaml",
      content: "name: Test\nversion: 1.0.0\nschema: v1\n",
    };

    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
      overrideFile,
    );

    await loader.doLoadConfig();

    expect(mockDoLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        packageIdentifier: expect.objectContaining({
          uriType: "file",
          fileUri: overrideFile.path,
          content: overrideFile.content,
        }),
      }),
    );
  });

  it("should not include content in packageIdentifier when no override file", async () => {
    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
    );

    await loader.doLoadConfig();

    expect(mockDoLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        packageIdentifier: expect.objectContaining({
          uriType: "file",
          content: undefined,
        }),
      }),
    );
  });

  it("uses the parsed name from the default local config when available", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue("config content" as any);
    mockParseConfigYaml.mockReturnValue({ name: "My Custom Config" } as any);

    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
    );

    expect(loader.description.title).toBe("My Custom Config");
  });

  it("prefers the override assistant content name when an override file is provided", () => {
    const readSpy = vi.spyOn(fs, "readFileSync");
    mockParseConfigYaml.mockReturnValue({ name: "Workspace Agent" } as any);

    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
      {
        path: "file:///tmp/custom.yaml",
        content: "config content",
      },
    );

    expect(loader.description.title).toBe("Workspace Agent");
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("does not fall back to the primary config when override content is empty", () => {
    const readSpy = vi.spyOn(fs, "readFileSync");

    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
      {
        path: "file:///tmp/empty.yaml",
        content: "",
      },
    );

    expect(loader.description.title).toBe("empty.yaml");
    expect(readSpy).not.toHaveBeenCalled();
  });
});
