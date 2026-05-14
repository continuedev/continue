import { describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";

import { grepSearchImpl } from "./grepSearch";

function createExtras(searchResults: unknown): ToolExtras {
  return {
    ide: {
      getSearchResults:
        typeof searchResults === "function"
          ? searchResults
          : vi.fn().mockResolvedValue(searchResults),
    } as any,
    llm: {} as any,
    fetch: vi.fn() as any,
    tool: {} as any,
    config: {} as any,
  } as ToolExtras;
}

describe("grepSearchImpl", () => {
  it("returns formatted search results", async () => {
    const result = await grepSearchImpl(
      { query: "todo" },
      createExtras(
        "./src/todo.ts\n  12:const todo = true;\n  13:return todo;\n",
      ),
    );

    expect(result).toEqual([
      {
        name: "Search results",
        description: "Results from grep search",
        content: "./src/todo.ts\n  12:const todo = true;\n  13:return todo;",
      },
    ]);
  });

  it("can split results by file", async () => {
    const result = await grepSearchImpl(
      { query: "todo", splitByFile: true },
      createExtras(
        "./src/todo.ts\n  12:const todo = true;\n./src/task.ts\n  7:const task = todo;\n",
      ),
    );

    expect(result).toEqual([
      {
        name: "Search results in src/todo.ts",
        description: "Grep search results from src/todo.ts",
        content: "12:const todo = true;",
        uri: { type: "file", value: "src/todo.ts" },
      },
      {
        name: "Search results in src/task.ts",
        description: "Grep search results from src/task.ts",
        content: "7:const task = todo;",
        uri: { type: "file", value: "src/task.ts" },
      },
    ]);
  });

  it("returns a helpful error item for invalid regex queries", async () => {
    const result = await grepSearchImpl(
      { query: "(" },
      createExtras(() =>
        Promise.reject(new Error("Process exited with code 2: invalid regex")),
      ),
    );

    expect(result[0]?.name).toBe("Search error");
    expect(result[0]?.content).toContain(
      "The search failed due to an invalid regex pattern.",
    );
    expect(result[0]?.content).toContain("Original query: (");
  });

  it("supports files_with_matches mode with pagination", async () => {
    const result = await grepSearchImpl(
      {
        query: "todo",
        outputMode: "files_with_matches",
        headLimit: 1,
        offset: 1,
      },
      createExtras("./src/todo.ts\n./src/task.ts\n./src/plan.ts\n"),
    );

    expect(result).toEqual([
      {
        name: "Search results",
        description: "Files with matches from grep search",
        content: "./src/task.ts",
      },
    ]);
  });

  it("supports count mode", async () => {
    const result = await grepSearchImpl(
      { query: "todo", outputMode: "count" },
      createExtras("./src/todo.ts:2\n./src/task.ts:1\n"),
    );

    expect(result).toEqual([
      {
        name: "Search results",
        description: "Match counts from grep search",
        content: "./src/todo.ts:2\n./src/task.ts:1",
      },
    ]);
  });

  it("accepts CLI-compatible aliases for query and mode args", async () => {
    const getSearchResults = vi.fn().mockResolvedValue("./src/todo.ts\n");
    const extras = createExtras(getSearchResults);

    await grepSearchImpl(
      {
        pattern: "todo",
        glob: "src/**",
        output_mode: "files_with_matches",
        case_insensitive: true,
      },
      extras,
    );

    expect(getSearchResults).toHaveBeenCalledWith(
      "todo",
      expect.objectContaining({
        includePattern: "src/**",
        caseSensitive: false,
        outputMode: "files_with_matches",
      }),
    );
  });
});
