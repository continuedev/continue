/* eslint-disable max-lines-per-function */
/* lint is not useful for test classes */
import { jest } from "@jest/globals";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "path";

import { LLMError } from "../llm/index.js";
import { testConfigHandler, testIde } from "../test/fixtures.js";
import {
  addToTestDir,
  setUpTestDir,
  tearDownTestDir,
  TEST_DIR,
  TEST_DIR_PATH,
} from "../test/testDir.js";
import { getIndexSqlitePath } from "../util/paths.js";

import { ConfigResult } from "@continuedev/config-yaml";
import CodebaseContextProvider from "../context/providers/CodebaseContextProvider.js";
import { ContinueConfig } from "../index.js";
import { localPathToUri } from "../util/pathToUri.js";
import { CodebaseIndexer } from "./CodebaseIndexer.js";
import { FullTextSearchCodebaseIndex } from "./FullTextSearchCodebaseIndex.js";
import { getComputeDeleteAddRemove } from "./refreshIndex.js";
import { TestCodebaseIndex } from "./TestCodebaseIndex.js";
import { CodebaseIndex } from "./types.js";
import { walkDir, walkDirCache } from "./walkDir.js";

jest.useFakeTimers();

const TEST_TS = `\
function main() {
  console.log("Hello, world!");
}

class Foo {
  constructor(public bar: string) {}
}
`;

const TEST_PY = `\
def main():
    print("Hello, world!")

class Foo:
    def __init__(self, bar: str):
        self.bar = bar
`;

const TEST_RS = `\
fn main() {
    println!("Hello, world!");
}

struct Foo {
    bar: String,
}
`;

// A subclass of CodebaseIndexer that adds a new CodebaseIndex
class TestCodebaseIndexer extends CodebaseIndexer {
  protected async getIndexesToBuild(): Promise<CodebaseIndex[]> {
    return [new TestCodebaseIndex()];
  }

  // Add public methods to test private methods
  public testHasIndexingProvider() {
    return (this as any).hasIndexingContextProvider();
  }

  public async testHandleConfigUpdate(
    configResult: ConfigResult<ContinueConfig>,
  ) {
    return (this as any).handleConfigUpdate({ config: configResult.config });
  }
}

// Create a mock messenger type that doesn't require actual protocol imports
type MockMessengerType = {
  send: jest.Mock;
  request: jest.Mock;
  invoke: jest.Mock;
  on: jest.Mock;
  onError: jest.Mock;
};

// These are more like integration tests, whereas we should separately test
// the individual CodebaseIndex classes
describe("CodebaseIndexer", () => {
  // Replace mockProgressReporter with mockMessenger
  const mockMessenger: MockMessengerType = {
    send: jest.fn(),
    request: jest.fn(async () => {}),
    invoke: jest.fn(),
    on: jest.fn(),
    onError: jest.fn(),
  };

  let codebaseIndexer: TestCodebaseIndexer;
  let testIndex: TestCodebaseIndex;

  beforeAll(async () => {
    tearDownTestDir();
    setUpTestDir();

    execSync("git init", { cwd: TEST_DIR_PATH });
    execSync('git config user.email "test@example.com"', {
      cwd: TEST_DIR_PATH,
    });
    execSync('git config user.name "Test"', { cwd: TEST_DIR_PATH });

    codebaseIndexer = new TestCodebaseIndexer(
      testConfigHandler,
      testIde,
      mockMessenger as any,
      false,
    );
    await codebaseIndexer.initPromise;
    testIndex = new TestCodebaseIndex();
  });

  afterAll(async () => {
    tearDownTestDir();
  });

  afterEach(() => {
    walkDirCache.invalidate();
    jest.clearAllMocks();
  });

  async function refreshIndex() {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const updates = [];
    for await (const update of codebaseIndexer.refreshDirs(
      [TEST_DIR],
      abortSignal,
    )) {
      updates.push(update);
    }
    return updates;
  }

  async function getAllIndexedFiles() {
    const files = await testIndex.getIndexedFilesForTags(
      await testIde.getTags(testIndex.artifactId),
    );
    return files;
  }

  async function getIndexPlan() {
    const workspaceFiles = await walkDir(TEST_DIR, testIde);
    const [tag] = await testIde.getTags(testIndex.artifactId);
    const stats = await testIde.getFileStats(workspaceFiles);

    const [results, lastUpdated, markComplete] =
      await getComputeDeleteAddRemove(
        tag,
        { ...stats },
        (filepath) => testIde.readFile(filepath),
        undefined,
      );
    return results;
  }

  async function expectPlan(
    compute: number,
    addTag: number,
    removeTag: number,
    del: number,
  ) {
    const plan = await getIndexPlan();
    expect(plan.compute).toHaveLength(compute);
    expect(plan.addTag).toHaveLength(addTag);
    expect(plan.removeTag).toHaveLength(removeTag);
    expect(plan.del).toHaveLength(del);
    return plan;
  }

  describe("Sequential Integration Tests", () => {
    // These tests must run in sequence as they depend on each other
    test("should index test folder without problem", async () => {
      walkDirCache.invalidate();
      addToTestDir([
        ["test.ts", TEST_TS],
        ["py/main.py", TEST_PY],
      ]);

      await expectPlan(2, 0, 0, 0);

      const updates = await refreshIndex();
      expect(updates.length).toBeGreaterThan(0);
    });

    test("should have created index folder with all necessary files", async () => {
      const exists = await testIde.fileExists(
        localPathToUri(getIndexSqlitePath()),
      );
      expect(exists).toBe(true);
    });

    test("should have indexed all of the files", async () => {
      const indexed = await getAllIndexedFiles();
      expect(indexed.length).toBe(2);
      expect(indexed.some((file) => file.endsWith("test.ts"))).toBe(true);
      expect(indexed.some((file) => file.endsWith("main.py"))).toBe(true);
    });

    test("should successfuly re-index specific files", async () => {
      // Could add more specific tests for this but uses similar logic
      const before = await getAllIndexedFiles();
      await codebaseIndexer.refreshCodebaseIndexFiles(before);

      const after = await getAllIndexedFiles();
      expect(after.length).toBe(before.length);
    });

    test("should successfully re-index after adding a file", async () => {
      addToTestDir([["main.rs", TEST_RS]]);

      await expectPlan(1, 0, 0, 0);

      const updates = await refreshIndex();
      expect(updates.length).toBeGreaterThan(0);

      // Check that the new file was indexed
      const files = await getAllIndexedFiles();
      expect(files.length).toBe(3);
      expect(files.some((file) => file.endsWith("main.rs"))).toBe(true);
    });

    test("should successfully re-index after deleting a file", async () => {
      fs.rmSync(path.join(TEST_DIR_PATH, "main.rs"));

      await expectPlan(0, 0, 0, 1);

      const updates = await refreshIndex();
      expect(updates.length).toBeGreaterThan(0);

      // Check that the deleted file was removed from the index
      const files = await getAllIndexedFiles();
      expect(files.length).toBe(2);
      expect(files.every((file) => !file.endsWith("main.rs"))).toBe(true);
    });

    test("shouldn't index any files when nothing changed", async () => {
      await expectPlan(0, 0, 0, 0);
      const updates = await refreshIndex();
      expect(updates.length).toBeGreaterThan(0);
    });

    test("should create git repo for testing", async () => {
      execSync(
        `cd ${TEST_DIR_PATH} && git init && git checkout -b main && git add -A && git commit -m "First commit"`,
      );
    });

    test.skip("should only re-index the changed files when changing branches", async () => {
      execSync(`cd ${TEST_DIR_PATH} && git checkout -b test2`);
      // Rewriting the file
      addToTestDir([["test.ts", "// This is different"]]);

      // Should re-compute test.ts, but just re-tag the .py file
      await expectPlan(1, 1, 0, 0);

      execSync(
        `cd ${TEST_DIR_PATH} && git add -A && git commit -m "Change .ts file"`,
      );
    });

    test.skip("shouldn't re-index anything when changing back to original branch", async () => {
      execSync(`cd ${TEST_DIR_PATH} && git checkout main`);
      await expectPlan(0, 0, 0, 0);
    });
  });

  // Isolated unit tests for Core.ts methods
  describe("Core.ts Methods (Isolated Unit Tests)", () => {
    beforeAll(async () => {
      // Clear database to ensure these tests don't interfere with sequential integration tests
      await testIndex.clearDatabase();
    });

    afterEach(async () => {
      // Clear after each test to ensure full isolation within this group
      await testIndex.clearDatabase();
    });

    // Simplified tests to focus on behavior, not implementation details
    test("should call messenger with progress updates when refreshing codebase index", async () => {
      jest
        .spyOn(codebaseIndexer as any, "refreshDirs")
        .mockImplementation(async function* () {
          yield { status: "done", progress: 1, desc: "Completed" };
        });

      await codebaseIndexer.refreshCodebaseIndex([TEST_DIR]);

      expect(mockMessenger.request).toHaveBeenCalledWith(
        "indexProgress",
        expect.anything(),
      );
      expect(mockMessenger.send).toHaveBeenCalledWith("refreshSubmenuItems", {
        providers: "all",
      });
    });

    test("should call messenger with progress updates when refreshing specific files", async () => {
      jest
        .spyOn(codebaseIndexer as any, "refreshFiles")
        .mockImplementation(async function* () {
          yield { status: "done", progress: 1, desc: "Completed" };
        });

      await codebaseIndexer.refreshCodebaseIndexFiles(["/test/file.ts"]);

      expect(mockMessenger.request).toHaveBeenCalledWith(
        "indexProgress",
        expect.anything(),
      );
      expect(mockMessenger.send).toHaveBeenCalledWith("refreshSubmenuItems", {
        providers: "all",
      });
    });

    test("should abort previous indexing when starting a new one", async () => {
      // Set up a situation where indexingCancellationController exists
      const mockAbort = jest.fn();
      const controller = { abort: mockAbort, signal: { aborted: false } };

      // Access the private property in a type-safe way for testing
      (codebaseIndexer as any).indexingCancellationController = controller;

      // Mock refreshDirs to return immediately
      jest
        .spyOn(codebaseIndexer as any, "refreshDirs")
        .mockImplementation(async function* () {
          yield { status: "done", progress: 1, desc: "Completed" };
        });

      // Start indexing - this should call abort on the existing controller
      await codebaseIndexer.refreshCodebaseIndex([TEST_DIR]);

      // Verify abort was called
      expect(mockAbort).toHaveBeenCalled();
    });

    test("should handle errors properly during indexing", async () => {
      const testError = new Error("Test indexing error");

      // Mock console.log to avoid printing errors
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      // Mock refreshDirs to throw an error
      jest
        .spyOn(codebaseIndexer as any, "refreshDirs")
        .mockImplementation(() => {
          throw testError;
        });

      // We don't need to mock AbortController because we're mocking the entire refreshDirs call
      await codebaseIndexer.refreshCodebaseIndex([TEST_DIR]);

      // Use the first argument only for the assertion since the second argument doesn't match exactly
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Failed refreshing codebase index directories: Error: ${testError.message}`,
      );
      expect(mockMessenger.request).toHaveBeenCalledWith(
        "indexProgress",
        expect.objectContaining({
          status: "failed",
        }),
      );

      consoleLogSpy.mockRestore();
    });

    test("should handle LLMError specially during indexing", async () => {
      // Create a mock LLM
      const mockLlm: any = {
        providerName: "test-provider",
        model: "test-model",
      };

      // Create a real LLMError
      const llmError = new LLMError("Test LLM error", mockLlm);

      // Mock console.log to avoid printing errors
      jest.spyOn(console, "log").mockImplementation(() => {});

      // Mock refreshDirs to throw an LLMError
      jest
        .spyOn(codebaseIndexer as any, "refreshDirs")
        .mockImplementation(() => {
          throw llmError;
        });

      // We don't need to mock AbortController because we're mocking the entire refreshDirs call
      await codebaseIndexer.refreshCodebaseIndex([TEST_DIR]);

      expect(mockMessenger.request).toHaveBeenCalledWith(
        "reportError",
        llmError,
      );
      expect(mockMessenger.request).toHaveBeenCalledWith(
        "indexProgress",
        expect.objectContaining({
          status: "failed",
          desc: "Test LLM error",
        }),
      );
    });

    test("should provide access to current indexing state", async () => {
      const testState = {
        progress: 0.5,
        status: "indexing" as const,
        desc: "Test state",
      };

      // Mock refreshDirs to set a specific state
      jest
        .spyOn(codebaseIndexer as any, "refreshDirs")
        .mockImplementation(async function* () {
          yield testState;
        });

      // We don't need to mock AbortController because we're mocking the entire refreshDirs call
      await codebaseIndexer.refreshCodebaseIndex([TEST_DIR]);

      // Check that the state was updated
      expect(codebaseIndexer.currentIndexingState).toEqual(testState);
    });
  });

  // Isolated unit tests for configuration handling
  describe("Configuration Handling (Isolated Unit Tests)", () => {
    beforeAll(async () => {
      // Clear database to ensure these tests don't interfere with other tests
      await testIndex.clearDatabase();
    });

    afterEach(async () => {
      // Clear after each test to ensure full isolation within this group
      await testIndex.clearDatabase();
    });
    let testIndexer: TestCodebaseIndexer;
    let mockRefreshCodebaseIndex: jest.MockedFunction<any>;
    let mockGetWorkspaceDirs: jest.MockedFunction<any>;

    beforeEach(() => {
      testIndexer = new TestCodebaseIndexer(
        testConfigHandler,
        testIde,
        mockMessenger as any,
        false,
      );

      // Mock the refreshCodebaseIndex method to avoid actual indexing
      mockRefreshCodebaseIndex = jest
        .spyOn(testIndexer, "refreshCodebaseIndex")
        .mockImplementation(async () => {});

      // Mock getWorkspaceDirs to return test directories
      mockGetWorkspaceDirs = jest
        .spyOn(testIde, "getWorkspaceDirs")
        .mockResolvedValue(["/test/workspace"]);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("hasIndexingProvider", () => {
      test("should return true when codebase context provider is present", () => {
        // Set up config with codebase context provider
        (testIndexer as any).config = {
          contextProviders: [new CodebaseContextProvider({})],
        };

        const result = testIndexer.testHasIndexingProvider();
        expect(result).toBe(true);
      });

      test("should return false when no context providers are configured", () => {
        (testIndexer as any).config = {
          contextProviders: undefined,
        };

        const result = testIndexer.testHasIndexingProvider();
        expect(result).toBe(false);
      });

      test("should return false when context providers exist but no codebase provider", () => {
        (testIndexer as any).config = {
          contextProviders: [
            {
              description: {
                title: "SomeOtherProvider",
              },
            },
          ],
        };

        const result = testIndexer.testHasIndexingProvider();
        expect(result).toBe(false);
      });

      test("should return false when context providers is empty array", () => {
        (testIndexer as any).config = {
          contextProviders: [],
        };

        const result = testIndexer.testHasIndexingProvider();
        expect(result).toBe(false);
      });
    });

    describe("handleConfigUpdate", () => {
      test("should return early when newConfig is null", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: null as any,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(0);
        expect(mockGetWorkspaceDirs).toHaveBeenCalledTimes(0);
      });

      test("should return early when newConfig is undefined", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: undefined as any,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(0);
        expect(mockGetWorkspaceDirs).toHaveBeenCalledTimes(0);
      });

      test("should return early when no codebase context provider is present", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: {
            contextProviders: [
              {
                description: {
                  title: "SomeOtherProvider",
                },
              },
            ],
            selectedModelByRole: {
              embed: {
                model: "test-model",
                provider: "test-provider",
              },
            },
          } as unknown as ContinueConfig,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(0);
        expect(mockGetWorkspaceDirs).toHaveBeenCalledTimes(0);
      });

      test("should return early when no embed model is configured", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: {
            contextProviders: [new CodebaseContextProvider({})],
            selectedModelByRole: {
              embed: undefined,
            },
          } as unknown as ContinueConfig,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(0);
        expect(mockGetWorkspaceDirs).toHaveBeenCalledTimes(0);
      });

      test("should call refreshCodebaseIndex when all conditions are met", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: {
            contextProviders: [new CodebaseContextProvider({})],
            selectedModelByRole: {
              embed: {
                model: "test-model",
                provider: "test-provider",
              },
            },
          } as unknown as ContinueConfig,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockGetWorkspaceDirs).toHaveBeenCalledTimes(1);
        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(1);
        expect(mockRefreshCodebaseIndex).toHaveBeenCalledWith([
          "/test/workspace",
        ]);
      });

      test("should set config property before checking conditions", async () => {
        const testConfig = {
          contextProviders: [new CodebaseContextProvider({})],
          selectedModelByRole: {
            embed: {
              model: "test-model",
              provider: "test-provider",
            },
          },
        } as unknown as ContinueConfig;

        const configResult: ConfigResult<ContinueConfig> = {
          config: testConfig,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        // Verify that the config was set
        expect((testIndexer as any).config).toBe(testConfig);
        // These get called once on init, and we want them to get called again
        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(1);
      });

      test("should handle multiple context providers correctly", async () => {
        const configResult: ConfigResult<ContinueConfig> = {
          config: {
            contextProviders: [
              {
                description: {
                  title: "SomeOtherProvider",
                },
              },
              new CodebaseContextProvider({}),
              {
                description: {
                  title: "AnotherProvider",
                },
              },
            ],
            selectedModelByRole: {
              embed: {
                model: "test-model",
                provider: "test-provider",
              },
            },
          } as unknown as ContinueConfig,
          errors: [],
          configLoadInterrupted: false,
        };

        await testIndexer.testHandleConfigUpdate(configResult);

        expect(mockRefreshCodebaseIndex).toHaveBeenCalledTimes(1);
        expect(mockRefreshCodebaseIndex).toHaveBeenCalledWith([
          "/test/workspace",
        ]);
      });
    });

    describe("getIndexesToBuild", () => {
      let indexer: CodebaseIndexer;
      let mockConfig: any;
      let mockEmbeddingsModel: any;
      let mockIdeSettings: any;

      beforeEach(async () => {
        indexer = new CodebaseIndexer(
          testConfigHandler,
          testIde,
          mockMessenger as any,
          false,
        );

        mockEmbeddingsModel = {
          maxEmbeddingChunkSize: 1000,
          model: "test-model",
          provider: "test-provider",
        };

        mockIdeSettings = {
          remoteConfigServerUrl: "http://test.com",
          userToken: "test-token",
        };

        mockConfig = {
          selectedModelByRole: {
            embed: mockEmbeddingsModel,
          },
          contextProviders: [],
        };

        jest
          .spyOn(testIde, "getIdeSettings")
          .mockResolvedValue(mockIdeSettings);
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      test("should create specific indexTypes for the requested context providers", async () => {
        mockConfig.contextProviders = [
          {
            description: {
              dependsOnIndexing: ["chunk", "codeSnippets"],
            },
          },
        ];

        jest.spyOn(testConfigHandler, "loadConfig").mockResolvedValue({
          config: mockConfig,
          errors: [],
          configLoadInterrupted: false,
        });

        const indexes = (await (
          indexer as any
        ).getIndexesToBuild()) as CodebaseIndex[];

        expect(indexes).toHaveLength(2);
        expect(indexes[0].artifactId).toBe("chunks");
        expect(indexes[1].artifactId).toBe("codeSnippets");
      });

      test("should handle duplicate contexts", async () => {
        mockConfig.contextProviders = [
          {
            description: {
              dependsOnIndexing: ["codeSnippets"],
            },
          },
          {
            description: {
              dependsOnIndexing: ["codeSnippets"],
            },
          },
        ];

        jest.spyOn(testConfigHandler, "loadConfig").mockResolvedValue({
          config: mockConfig,
          errors: [],
          configLoadInterrupted: false,
        });

        const indexes = await (indexer as any).getIndexesToBuild();

        expect(indexes).toHaveLength(1);
        expect(indexes[0].artifactId).toBe("codeSnippets");
      });
    });
  });

  describe("wasAnyOneIndexAdded", () => {
    let testIndexer: TestCodebaseIndexer;
    let mockGetIndexesToBuild: jest.MockedFunction<any>;

    beforeEach(() => {
      testIndexer = new TestCodebaseIndexer(
        testConfigHandler,
        testIde,
        mockMessenger as any,
        false,
      );

      // Mock getIndexesToBuild to control what indexes should be built
      mockGetIndexesToBuild = jest
        .spyOn(testIndexer as any, "getIndexesToBuild")
        .mockResolvedValue([]);

      jest
        .spyOn(testIndexer, "refreshCodebaseIndex")
        .mockImplementation(async () => {});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("should return true when indexes to build differ from built indexes", async () => {
      const mockIndex1 = new TestCodebaseIndex();
      const mockIndex2 = new FullTextSearchCodebaseIndex();
      mockGetIndexesToBuild.mockResolvedValue([mockIndex1]);
      (testIndexer as any).builtIndexes = [mockIndex2];

      const result = await testIndexer.wasAnyOneIndexAdded();
      expect(result).toBe(true);
    });

    test("should return true when there are more indexes to build than built indexes", async () => {
      const mockIndex1 = new TestCodebaseIndex();
      const mockIndex2 = new FullTextSearchCodebaseIndex();
      mockGetIndexesToBuild.mockResolvedValue([mockIndex1, mockIndex2]);
      (testIndexer as any).builtIndexes = [mockIndex1];

      const result = await testIndexer.wasAnyOneIndexAdded();
      expect(result).toBe(true);
    });

    test("should return false when there are fewer indexes to build than built indexes", async () => {
      const mockIndex1 = new TestCodebaseIndex();
      const mockIndex2 = new FullTextSearchCodebaseIndex();
      mockGetIndexesToBuild.mockResolvedValue([mockIndex1]);
      (testIndexer as any).builtIndexes = [mockIndex1, mockIndex2];

      const result = await testIndexer.wasAnyOneIndexAdded();
      expect(result).toBe(false);
    });
  });
});
