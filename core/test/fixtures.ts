import { ConfigHandler } from "../config/ConfigHandler";
<<<<<<< HEAD
import { ControlPlaneClient } from "../control-plane/client";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import Mock from "../llm/llms/Mock";
import { LLMLogger } from "../llm/logger";
import FileSystemIde from "../util/filesystem";

import { TEST_DIR } from "./testDir";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

<<<<<<< HEAD
export const testControlPlaneClient = new ControlPlaneClient(
  Promise.resolve(undefined),
  testIde,
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  new LLMLogger(),
  Promise.resolve(undefined),
);
=======
export const testConfigHandler = new ConfigHandler(testIde, new LLMLogger());
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

export const testLLM = new Mock({
  model: "mock-model",
  title: "Mock LLM",
  uniqueId: "not-unique",
});
