import { describe, expect, it, vi } from "vitest";

<<<<<<< HEAD
import { ControlPlaneClient } from "../../control-plane/client.js";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
<<<<<<< HEAD
  const controlPlaneClient = new ControlPlaneClient(
    Promise.resolve(undefined),
    testIde,
  );
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  const llmLogger = new LLMLogger();

  it("should pass pre-read content in packageIdentifier for override files", async () => {
    const overrideFile = {
      path: "vscode-remote://wsl+Ubuntu/home/user/.continue/agents/test.yaml",
      content: "name: Test\nversion: 1.0.0\nschema: v1\n",
    };

<<<<<<< HEAD
    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
      overrideFile,
    );
=======
    const loader = new LocalProfileLoader(testIde, llmLogger, overrideFile);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

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
<<<<<<< HEAD
    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
    );
=======
    const loader = new LocalProfileLoader(testIde, llmLogger);
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

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

  it("should update title from configName when available", async () => {
    mockDoLoadConfig.mockResolvedValueOnce({
      config: {},
      errors: [],
      configLoadInterrupted: false,
      configName: "My Custom Config",
    });

<<<<<<< HEAD
    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
    );

    expect(loader.description.title).toBe("Local Config");
=======
    const loader = new LocalProfileLoader(testIde, llmLogger);

    expect(loader.description.title).toBe("Main Config");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

    await loader.doLoadConfig();

    expect(loader.description.title).toBe("My Custom Config");
  });

  it("should keep default title when configName is not set", async () => {
    mockDoLoadConfig.mockResolvedValueOnce({
      config: {},
      errors: [],
      configLoadInterrupted: false,
    });

<<<<<<< HEAD
    const loader = new LocalProfileLoader(
      testIde,
      controlPlaneClient,
      llmLogger,
    );

    await loader.doLoadConfig();

    expect(loader.description.title).toBe("Local Config");
=======
    const loader = new LocalProfileLoader(testIde, llmLogger);

    await loader.doLoadConfig();

    expect(loader.description.title).toBe("Main Config");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  });
});
