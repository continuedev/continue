import fetch from "node-fetch";

import {
  ContextProviderExtras,
  ContextProviderWithParams,
  IContextProvider,
} from "../..";
import { ConfigHandler } from "../../config/ConfigHandler";
import { contextProviderClassFromName } from ".";
import { ControlPlaneClient } from "../../control-plane/client";
import FileSystemIde from "../../util/filesystem";
import { TEST_DIR } from "../../test/testDir";

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
    new ControlPlaneClient(Promise.resolve(undefined)),
  );
  const config = await configHandler.loadConfig();

  return {
    fullInput,
    ide,
    config,
    embeddingsProvider: config.embeddingsProvider,
    fetch: fetch,
    llm: config.models[0],
    reranker: config.reranker,
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
