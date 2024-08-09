import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ContinueServerClient } from "../../continueServer/stubs/client.js";
import { ControlPlaneClient } from "../../control-plane/client.js";
import { CodebaseIndexer, PauseToken } from "../../indexing/CodebaseIndexer.js";
import { getComputeDeleteAddRemove } from "../../indexing/refreshIndex.js";
import { TestCodebaseIndex } from "../../indexing/TestCodebaseIndex.js";
import { CodebaseIndex } from "../../indexing/types.js";
import { walkDir } from "../../indexing/walkDir.js";
import FileSystemIde from "../../util/filesystem.js";
import { getIndexSqlitePath } from "../../util/paths.js";
import {
  addToTestDir,
  setUpTestDir,
  tearDownTestDir,
  TEST_DIR,
} from "../testUtils/testDir.js";

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
}

// These are more like integration tests, whereas we should separately test
// the individual CodebaseIndex classes
describe("CodebaseIndexer", () => {
  const ide = new FileSystemIde(TEST_DIR);
  const ideSettingsPromise = ide.getIdeSettings();
  const configHandler = new ConfigHandler(
    ide,
    ideSettingsPromise,
    async (text) => {},
    new ControlPlaneClient(Promise.resolve(undefined)),
  );
  const pauseToken = new PauseToken(false);
  const continueServerClient = new ContinueServerClient(undefined, undefined);
  const codebaseIndexer = new TestCodebaseIndexer(
    configHandler,
    ide,
    pauseToken,
    continueServerClient,
  );
  const testIndex = new TestCodebaseIndex();

  beforeAll(async () => {
    tearDownTestDir();
    setUpTestDir();
  });

  afterAll(async () => {
    tearDownTestDir();
  });

  async function refreshIndex() {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const updates = [];
    for await (const update of codebaseIndexer.refresh(
      [TEST_DIR],
      abortSignal,
    )) {
      updates.push(update);
    }
    return updates;
  }

  async function getAllIndexedFiles() {
    const files = await testIndex.getIndexedFilesForTags(
      await ide.getTags(testIndex.artifactId),
    );
    return files;
  }

  async function getIndexPlan() {
    const workspaceFiles = await walkDir(TEST_DIR, ide);
    const [tag] = await ide.getTags(testIndex.artifactId);
    const stats = await ide.getLastModified(workspaceFiles);

    const [results, lastUpdated, markComplete] =
      await getComputeDeleteAddRemove(
        tag,
        { ...stats },
        (filepath) => ide.readFile(filepath),
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
    const results = await getIndexPlan();
    expect(results.compute).toHaveLength(compute);
    expect(results.addTag).toHaveLength(addTag);
    expect(results.removeTag).toHaveLength(removeTag);
    expect(results.del).toHaveLength(del);
  }

  test("should index test folder without problem", async () => {
    addToTestDir([
      ["test.ts", TEST_TS],
      ["py/main.py", TEST_PY],
    ]);

    await expectPlan(2, 0, 0, 0);

    const updates = await refreshIndex();
    expect(updates.length).toBeGreaterThan(0);
  });

  test("should have created index folder with all necessary files", async () => {
    expect(fs.existsSync(getIndexSqlitePath())).toBe(true);
  });

  test("should have indexed all of the files", async () => {
    const indexed = await getAllIndexedFiles();
    expect(indexed.length).toBe(2);
    expect(indexed.some((file) => file.endsWith("test.ts"))).toBe(true);
    expect(indexed.some((file) => file.endsWith("main.py"))).toBe(true);
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
    fs.rmSync(path.join(TEST_DIR, "main.rs"));

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
  });
});
