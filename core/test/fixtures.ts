import { ConfigHandler } from "../config/ConfigHandler";
import { ControlPlaneClient } from "../control-plane/client";
import { llmFromDescription } from "../llm/llms";
import FileSystemIde from "../util/filesystem";

import { TEST_DIR } from "./testDir";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

export const testControlPlaneClient = new ControlPlaneClient(
  Promise.resolve(undefined),
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  ideSettingsPromise,
  async (text) => {},
  testControlPlaneClient,
);

export const getTestLLM = async () => {
  const ideSettings = await ideSettingsPromise;
  const config = await testConfigHandler.loadConfig();
  const uniqueId = await testIde.getUniqueId();
  return await llmFromDescription(
    {
      provider: "mock",
      title: "Mock Model",
      model: "mock-model",
    },
    testIde.readFile.bind(testIde),
    uniqueId,
    ideSettings,
    async (log: string) => {
      console.log(log);
    },
    config.completionOptions,
    config.systemMessage,
  );
};
