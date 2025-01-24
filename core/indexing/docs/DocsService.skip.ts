/**
 * @jest-environment jsdom
 */
import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { SiteIndexingConfig } from "../../index.js";
import FileSystemIde from "../../util/filesystem.js";
import { editConfigJson } from "../../util/paths.js";

import DocsService from "./DocsService.js";
import preIndexedDocs from "./preIndexedDocs.js";

describe.skip("DocsService Integration Tests", () => {
  let ide: FileSystemIde;
  let configHandler: ConfigHandler;
  let docsService: DocsService;

  const mockSiteConfig: SiteIndexingConfig = {
    startUrl: "https://amplified.dev/",
    title: "Test repo",
    faviconUrl: "https://github.com/favicon.ico",
  };

  /**
   * We need to reload config explicitly to handle the scenario where the
   * config file update listeners are not called before we attempt to
   * use the new config
   */
  async function getReloadedConfig() {
    await configHandler.reloadConfig();
    const latestConfig = await configHandler.loadConfig();

    return latestConfig;
  }

  beforeEach(async () => {
    ide = new FileSystemIde(process.cwd());

    const ideSettingsPromise = Promise.resolve({
      remoteConfigSyncPeriod: 60,
      userToken: "",
      enableControlServerBeta: false,
      continueTestEnvironment: "none" as const,
      pauseCodebaseIndexOnStart: false,
      ideSettings: {} as any,
      enableDebugLogs: false,
      remoteConfigServerUrl: "",
    });
    configHandler = new ConfigHandler(
      ide,
      ideSettingsPromise,
      async () => {},
      new ControlPlaneClient(
        Promise.resolve({
          accessToken: "",
          account: {
            id: "",
            label: "",
          },
        }),
        ideSettingsPromise,
      ),
    );

    docsService = DocsService.createSingleton(configHandler, ide);

    await docsService.isInitialized;
  });

  test("Indexing, retrieval, and deletion of a new documentation site", async () => {
    await docsService.indexAndAdd(mockSiteConfig);

    let latestConfig = await getReloadedConfig();

    // Sqlite check
    expect(await docsService.hasMetadata(mockSiteConfig.startUrl)).toBe(true);

    // config.json check
    expect(latestConfig.config!.docs).toContainEqual(mockSiteConfig);

    // Lance DB check
    let retrievedChunks = await docsService.retrieveChunksFromQuery(
      "test",
      mockSiteConfig.startUrl,
      5,
    );

    expect(retrievedChunks.length).toBeGreaterThan(0);

    await docsService.delete(mockSiteConfig.startUrl);

    // Sqlite check
    expect(await docsService.hasMetadata(mockSiteConfig.startUrl)).toBe(false);

    // config.json check
    latestConfig = await getReloadedConfig();
    expect(latestConfig.config!.docs).not.toContainEqual(
      expect.objectContaining(mockSiteConfig),
    );

    // LanceDB check
    retrievedChunks = await docsService.retrieveChunksFromQuery(
      "test",
      mockSiteConfig.startUrl,
      5,
    );
    expect(retrievedChunks.length).toBe(0);
  });

  // test("Reindexes when changing embeddings provider", async () => {
  //   const originalEmbeddingsProvider =
  //     await docsService.getEmbeddingsProvider();

  //   // Change embeddings provider
  //   editConfigJson((config) => ({
  //     ...config,
  //     embeddingsProvider: {
  //       provider: FreeTrial.providerName,
  //     },
  //   }));

  //   await getReloadedConfig();

  //   const { provider, isPreindexed} = await docsService.getEmbeddingsProvider();

  //   // Verify reindexing
  //   const [originalVector] = await originalEmbeddingsProvider.embed(["test"]);
  //   const [newMockVector] = await provider.embed(["test"]);

  //   expect(originalVector).not.toEqual(newMockVector);
  // });

  test("Handles pulling down and adding pre-indexed docs", async () => {
    const preIndexedDoc = Object.values(preIndexedDocs)[0];
    await docsService.indexAndAdd(preIndexedDoc);
  });

  test("Config synchronization with SQLite", async () => {
    await docsService.indexAndAdd(mockSiteConfig);

    await getReloadedConfig();

    expect(await docsService.hasMetadata(mockSiteConfig.startUrl)).toBe(true);

    editConfigJson((config) => {
      const { docs, ...restConfig } = config;
      return restConfig;
    });

    await getReloadedConfig();

    const startTime = Date.now();
    const maxWaitTimeMs = 10_000;

    while (docsService.isSyncing) {
      if (Date.now() - startTime > maxWaitTimeMs) {
        throw new Error(
          `Timeout: docsService.isSyncing did not complete within within ${maxWaitTimeMs}ms`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(await docsService.hasMetadata(mockSiteConfig.startUrl)).toBe(false);
  });
});
