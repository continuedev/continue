/* eslint-disable @typescript-eslint/naming-convention */
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex";
import { DatabaseConnection, SqliteDb } from "../../indexing/refreshIndex";
import { IndexResultType } from "../../indexing/types";
import { testIde } from "../fixtures";
import {
  insertMockChunks,
  mockPathAndCacheKey,
  updateIndexAndAwaitGenerator,
} from "./utils";
import { jest } from "@jest/globals";

describe("CodeSnippetsCodebaseIndex", () => {
  let index: CodeSnippetsCodebaseIndex;
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = await SqliteDb.get();
    index = new CodeSnippetsCodebaseIndex(testIde);
  });

  it("should update the index and maintain expected database state, following the same processing order of results as the update method", async () => {
    const mockMarkComplete = jest
      .fn()
      .mockImplementation(() => Promise.resolve()) as any;

    const mockSnippet = {
      title: "",
      content: "",
      startLine: 0,
      endLine: 1,
    };

    // We mock this fn since currently in testing the directory structure to access the tree-sitter
    // binaries does not match what is in the release environment.
    jest
      .spyOn(CodeSnippetsCodebaseIndex.prototype, "getSnippetsInFile")
      .mockResolvedValue([mockSnippet]);

    await insertMockChunks();

    // Compute test
    await updateIndexAndAwaitGenerator(index, "compute", mockMarkComplete);

    const computeResult = await db.get(
      "SELECT * FROM code_snippets WHERE path = ?",
      [mockPathAndCacheKey.path],
    );

    const computeResultTags = await db.get(
      "SELECT * FROM code_snippets_tags WHERE snippetId = ?",
      [computeResult.id],
    );

    expect(computeResult).toBeTruthy();
    expect(computeResultTags).toBeTruthy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Compute,
    );

    // Delete test
    await updateIndexAndAwaitGenerator(index, "del", mockMarkComplete);

    const delResult = await db.get("SELECT * FROM code_snippets WHERE id = ?", [
      computeResult.id,
    ]);

    const delResultTags = await db.get(
      "SELECT * FROM code_snippets_tags WHERE id = ?",
      [computeResultTags.id],
    );

    expect(delResult).toBeFalsy();
    expect(delResultTags).toBeFalsy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.Delete,
    );

    // AddTag test
    await updateIndexAndAwaitGenerator(index, "addTag", mockMarkComplete);

    const addTagResult = await db.get(
      "SELECT * FROM code_snippets WHERE path = ?",
      [mockPathAndCacheKey.path],
    );

    const addTagResultTags = await db.get(
      "SELECT * FROM code_snippets_tags WHERE snippetId = ?",
      [addTagResult.id],
    );

    expect(addTagResult).toBeTruthy();
    expect(addTagResultTags).toBeTruthy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.AddTag,
    );

    // RemoveTag test
    await updateIndexAndAwaitGenerator(index, "removeTag", mockMarkComplete);

    const removeTagResultTag = await db.get(
      "SELECT * FROM code_snippets_tags WHERE id = ?",
      [addTagResultTags.id],
    );

    expect(removeTagResultTag).toBeFalsy();
    expect(mockMarkComplete).toHaveBeenCalledWith(
      [mockPathAndCacheKey],
      IndexResultType.RemoveTag,
    );
  });
});
