import { ConfigHandler } from "../config/ConfigHandler";
import { ControlPlaneClient } from "../control-plane/client";
import Mock from "../llm/llms/Mock";
import { LLMLogger } from "../llm/logger";
import FileSystemIde from "../util/filesystem";

import { TEST_DIR } from "./testDir";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

export const testControlPlaneClient = new ControlPlaneClient(
  Promise.resolve(undefined),
  ideSettingsPromise,
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  ideSettingsPromise,
  new LLMLogger(),
  Promise.resolve(undefined),
);

export const testLLM = new Mock({
  model: "mock-model",
  title: "Mock LLM",
  uniqueId: "not-unique",
});
