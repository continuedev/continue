/**
 * @jest-environment jsdom
 */
import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { SiteIndexingConfig } from "../../index.js";
import FileSystemIde from "../../util/filesystem.js";
import { editConfigJson } from "../../util/paths.js";
import FreeTrialEmbeddingsProvider from "../embeddings/FreeTrialEmbeddingsProvider.js";

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

    configHandler = new ConfigHandler(
      ide,
      Promise.resolve({
        remoteConfigSyncPeriod: 60,
        userToken: "",
        enableControlServerBeta: false,
        pauseCodebaseIndexOnStart: false,
        ideSettings: {} as any,
        enableDebugLogs: false,
        remoteConfigServerUrl: "",
      }),
      async () => {},
      new ControlPlaneClient(
        Promise.resolve({
          accessToken: "",
          account: {
            id: "",
            label: "",
          },
        }),
      ),
    );

    docsService = DocsService.createSingleton(configHandler, ide);

    await docsService.isInitialized;
  });

  test("Indexing, retrieval, and deletion of a new documentation site", async () => {
    const generator = docsService.indexAndAdd(mockSiteConfig);
    while (!(await generator.next()).done) {}

    let latestConfig = await getReloadedConfig();

    // Sqlite check
    expect(await docsService.has(mockSiteConfig.startUrl)).toBe(true);

    // config.json check
    expect(latestConfig.docs).toContainEqual(mockSiteConfig);

    // Lance DB check
    const embeddingsProvider = await docsService.getEmbeddingsProvider();
    const [mockVector] = await embeddingsProvider.embed(["test"]);
    let retrievedChunks = await docsService.retrieveChunks(
      mockSiteConfig.startUrl,
      mockVector,
      5,
    );

    expect(retrievedChunks.length).toBeGreaterThan(0);

    await docsService.delete(mockSiteConfig.startUrl);

    // Sqlite check
    expect(await docsService.has(mockSiteConfig.startUrl)).toBe(false);

    // config.json check
    latestConfig = await getReloadedConfig();
    expect(latestConfig.docs).not.toContainEqual(
      expect.objectContaining(mockSiteConfig),
    );

    // LanceDB check
    retrievedChunks = await docsService.retrieveChunks(
      mockSiteConfig.startUrl,
      mockVector,
      5,
    );
    expect(retrievedChunks.length).toBe(0);
  });

  test("Reindexes when changing embeddings provider", async () => {
    const originalEmbeddingsProvider =
      await docsService.getEmbeddingsProvider();

    // Change embeddings provider
    editConfigJson((config) => ({
      ...config,
      embeddingsProvider: {
        provider: FreeTrialEmbeddingsProvider.providerName,
      },
    }));

    await getReloadedConfig();

    const newEmbeddingsProvider = await docsService.getEmbeddingsProvider();

    // Verify reindexing
    const [originalVector] = await originalEmbeddingsProvider.embed(["test"]);
    const [newMockVector] = await newEmbeddingsProvider.embed(["test"]);

    expect(originalVector).not.toEqual(newMockVector);
  });

  test("Handles pulling down and adding pre-indexed docs", async () => {
    const preIndexedDoc = Object.values(preIndexedDocs)[0];
    const generator = docsService.indexAndAdd(preIndexedDoc);
    while (!(await generator.next()).done) {}
  });

  test("Config synchronization with SQLite", async () => {
    const generator = docsService.indexAndAdd(mockSiteConfig);
    while (!(await generator.next()).done) {}

    await getReloadedConfig();

    expect(await docsService.has(mockSiteConfig.startUrl)).toBe(true);

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

    expect(await docsService.has(mockSiteConfig.startUrl)).toBe(false);
  });
});
