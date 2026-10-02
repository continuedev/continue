import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./chunk/basic.js", () => ({
  basicChunker: async function* (text: string) {
    yield { content: text };
  },
}));

import { LanceDbIndex } from "./LanceDbIndex";
import { SqliteDb } from "./refreshIndex";

describe("LanceDbIndex.retrieve", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    (LanceDbIndex as any).lance = null;
  });

  it("returns early when vector search has no matches", async () => {
    const connect = vi.fn().mockResolvedValue({});
    (LanceDbIndex as any).lance = { connect };

    const index = Object.create(LanceDbIndex.prototype) as LanceDbIndex;
    Object.defineProperty(index, "embeddingsProvider", {
      value: {
        maxEmbeddingChunkSize: 100,
        embed: vi.fn().mockResolvedValue([[0.1]]),
      },
    });
    vi.spyOn(index as any, "_retrieveForTag").mockResolvedValue([]);
    const sqliteGet = vi.spyOn(SqliteDb, "get");

    await expect(
      index.retrieve("search query", 10, [{} as any], undefined),
    ).resolves.toEqual([]);

    expect(connect).toHaveBeenCalledOnce();
    expect(sqliteGet).not.toHaveBeenCalled();
  });
});
