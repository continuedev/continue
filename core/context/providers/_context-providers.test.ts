import fetch from "node-fetch";

import { contextProviderClassFromName } from ".";
import {
  ContextProviderExtras,
  ContextProviderWithParams,
  IContextProvider,
} from "../..";
import { ConfigHandler } from "../../config/ConfigHandler";
import { ControlPlaneClient } from "../../control-plane/client";
import { TEST_DIR } from "../../test/testDir";
import FileSystemIde from "../../util/filesystem";

const CONTEXT_PROVIDERS_TO_TEST: ContextProviderWithParams[] = [
  { name: "diff", params: {} },
  { name: "currentFile", params: {} },
  { name: "debugger", params: {} },
  { name: "open", params: {} },
  { name: "os", params: {} },
  { name: "problems", params: {} },
  { name: "terminal", params: {} },
  { name: "tree", params: {} },
];

async function getContextProviderExtras(
  fullInput: string,
): Promise<ContextProviderExtras> {
  const ide = new FileSystemIde(TEST_DIR);
  const ideSettingsPromise = ide.getIdeSettings();
  const configHandler = new ConfigHandler(
    ide,
    ideSettingsPromise,
    async (text) => {},
    new ControlPlaneClient(Promise.resolve(undefined), ideSettingsPromise),
  );
  const { config } = await configHandler.loadConfig();
  if (!config) {
    throw new Error("Config not found");
  }

  return {
    fullInput,
    ide,
    config,
    embeddingsProvider: config.selectedModelByRole.embed,
    fetch: fetch,
    llm: config.models[0],
    reranker: config.selectedModelByRole.rerank,
    selectedCode: [],
  };
}

describe.skip("Should successfully run all context providers", () => {
  const extrasPromise = getContextProviderExtras("Test");

  CONTEXT_PROVIDERS_TO_TEST.forEach((provider) => {
    test(`should successfully run ${provider.name} context provider`, async () => {
      const cls = contextProviderClassFromName(provider.name) as any;
      const instance: IContextProvider = new cls(provider.params);

      expect(instance.description.title).toBe(provider.name);

      const items = await instance.getContextItems("test", await extrasPromise);

      expect(Array.isArray(items)).toBe(true);
    });
  });
});
