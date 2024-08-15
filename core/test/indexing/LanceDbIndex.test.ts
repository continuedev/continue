import { DatabaseConnection, SqliteDb } from "../../indexing/refreshIndex";
import { IndexResultType } from "../../indexing/types";
import { testIde } from "../fixtures";
import { jest } from "@jest/globals";
import {
  insertMockChunks,
  mockPathAndCacheKey,
  mockTag,
  testContinueServerClient,
  updateIndexAndAwaitGenerator,
} from "./utils";
import { LanceDbIndex } from "../../indexing/LanceDbIndex";
import { testConfigHandler } from "../fixtures";
import lance from "vectordb";
import { getLanceDbPath } from "../../util/paths";

jest.useFakeTimers();

describe("ChunkCodebaseIndex", () => {
  let index: LanceDbIndex;
  let sqliteDb: DatabaseConnection;
  let lanceDb: lance.Connection;
  let lanceTableName: string;

  async function getAllSqliteLanceDbCache() {
    return await sqliteDb.all("SELECT * FROM lance_db_cache");
  }

  beforeAll(async () => {
    const pathSep = await testIde.pathSep();
    const mockConfig = await testConfigHandler.loadConfig();

    index = new LanceDbIndex(
      mockConfig.embeddingsProvider,
      testIde.readFile.bind(testIde),
      pathSep,
      testContinueServerClient,
    );

    sqliteDb = await SqliteDb.get();
    lanceDb = await lance.connect(getLanceDbPath());
    lanceTableName = index.tableNameForTag(mockTag);
  });

  it("should update the index and maintain expected database state", async () => {
    const mockMarkComplete = jest
      .fn()
      .mockImplementation(() => Promise.resolve()) as any;

    await insertMockChunks();

    // Compute test - inserts into both LanceDB and Sqlite
    await updateIndexAndAwaitGenerator(index, "compute", mockMarkComplete);

    // Note that we must wait until the first call 'compute' result has been processed.
    // The current functionality of the `update` function doesn't insert into the Lance DB
    // table until this point. We need to wait for this event to avoid needing to create a
    // mock embedding to instantiate the table with.
    const table = await lanceDb.openTable(lanceTableName);

    expect(await table.countRows()).toBe(1);
    expect((await getAllSqliteLanceDbCache()).length).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // AddTag test - only inserts into Lance DB
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);

    expect(await table.countRows()).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // // RemoveTag test - only removes from  Lance DB
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);
    expect(await table.countRows()).toBe(1);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );

    // Delete test - only removes from Sqlite
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);
    expect((await getAllSqliteLanceDbCache()).length).toBe(0);
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );
  });
});
