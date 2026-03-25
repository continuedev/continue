import { describe, expect, it, vi } from "vitest";

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

describe("LocalProfileLoader", () => {
  const llmLogger = new LLMLogger();

  it("should pass pre-read content in packageIdentifier for override files", async () => {
    const overrideFile = {
      path: "vscode-remote://wsl+Ubuntu/home/user/.continue/agents/test.yaml",
      content: "name: Test\nversion: 1.0.0\nschema: v1\n",
    };

    const loader = new LocalProfileLoader(testIde, llmLogger, overrideFile);

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
    const loader = new LocalProfileLoader(testIde, llmLogger);

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
});
