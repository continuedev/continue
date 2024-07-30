/**
 * @jest-environment jsdom
 */

import { TextEncoder, TextDecoder } from "util";
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

import * as fs from "fs";
import FileSystemIde from "../../util/filesystem.js";
import { ContinueConfig } from "../../index.js";
import DocsService from "../../indexing/docs/DocsService.js";
import { getConfigJsonPath } from "../../util/paths.js";

// Mock dependencies
// jest.mocked("../../util/getMetaUrl.ts");

describe("DocsService Integration Tests", () => {
  let ide: FileSystemIde;
  let config: ContinueConfig;
  let docsService: DocsService;

  beforeAll(() => {
    ide = new FileSystemIde(process.cwd());
    config = JSON.parse(fs.readFileSync(getConfigJsonPath(), "utf8"));
  });

  beforeEach(() => {
    docsService = new DocsService(config, ide);
  });

  test.only("Indexing and retrieval of a new documentation site", async () => {
    const siteConfig = {
      startUrl: "https://github.com/continuedev/amplified.dev",
      title: "Amplified Dev",
    };

    const indexGenerator = docsService.indexAndAdd(siteConfig);

    for await (const update of indexGenerator) {
      expect(update.status).toMatch(/indexing|done/);
    }

    expect(await docsService.has(siteConfig.startUrl)).toBe(true);

    const mockVector = [0.1, 0.2, 0.3];
    const retrievedChunks = await docsService.retrieveEmbeddings(
      siteConfig.startUrl,
      mockVector,
      5,
    );

    expect(retrievedChunks.length).toBeGreaterThan(0);
    expect(retrievedChunks[0].otherMetadata?.title).toBe(siteConfig.title);
  });

  // test("2. Deleting a documentation site", async () => {
  //   const siteConfig = {
  //     startUrl: "https://example.com",
  //     title: "Example Docs",
  //   };
  //   await docsService.indexAndAdd(siteConfig).next();

  //   await docsService.delete(siteConfig.startUrl);

  //   expect(await docsService.has(siteConfig.startUrl)).toBe(false);
  //   expect(config.docs).not.toContainEqual(expect.objectContaining(siteConfig));
  // });

  // test("3. Reindexing when changing the embeddings provider", async () => {
  //   const siteConfigs = [
  //     { startUrl: "https://example1.com", title: "Example Docs 1" },
  //     { startUrl: "https://example2.com", title: "Example Docs 2" },
  //   ];

  //   for (const siteConfig of siteConfigs) {
  //     await docsService.indexAndAdd(siteConfig).next();
  //   }

  //   // Change embeddings provider
  //   const newConfig = {
  //     ...config,
  //     embeddingsProvider: {
  //       id: "new-provider",
  //       type: "openai",
  //     } as EmbeddingsProvider,
  //   };
  //   docsService = new DocsService(newConfig, mockIde, mockMessenger);

  //   // Verify reindexing
  //   for (const siteConfig of siteConfigs) {
  //     const retrievedChunks = await docsService.retrieveEmbeddings(
  //       siteConfig.startUrl,
  //       [0.1, 0.2, 0.3],
  //       5,
  //     );
  //     expect(retrievedChunks.length).toBeGreaterThan(0);
  //   }
  // });

  // test("4. Handling of pre-indexed documentation", async () => {
  //   const preIndexedUrl = "https://preindexed.com";
  //   const mockVector = [0.1, 0.2, 0.3];

  //   // First retrieval should trigger fetching and adding
  //   const firstRetrieval = await docsService.retrieveEmbeddings(
  //     preIndexedUrl,
  //     mockVector,
  //     5,
  //   );
  //   expect(firstRetrieval.length).toBeGreaterThan(0);

  //   // Second retrieval should work without fetching
  //   const secondRetrieval = await docsService.retrieveEmbeddings(
  //     preIndexedUrl,
  //     mockVector,
  //     5,
  //   );
  //   expect(secondRetrieval.length).toBeGreaterThan(0);

  //   expect(await docsService.has(preIndexedUrl)).toBe(true);
  // });

  // test("6. Config synchronization with SQLite", async () => {
  //   const newDoc = { startUrl: "https://newdoc.com", title: "New Doc" };

  //   // Add new doc to config
  //   config.docs.push(newDoc);
  //   docsService = new DocsService(config, mockIde, mockMessenger);

  //   // Verify it's indexed and added to SQLite
  //   expect(await docsService.has(newDoc.startUrl)).toBe(true);

  //   // Remove doc from config
  //   config.docs = config.docs.filter((doc) => doc.startUrl !== newDoc.startUrl);
  //   docsService = new DocsService(config, mockIde, mockMessenger);

  //   // Verify it's removed from SQLite and LanceDB
  //   expect(await docsService.has(newDoc.startUrl)).toBe(false);
  // });
});
