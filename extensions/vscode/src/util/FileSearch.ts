import { IDE } from "core";
import { walkDirs } from "core/indexing/walkDir";
import { deduplicateArray, splitCamelCaseAndNonAlphaNumeric } from "core/util";
// @ts-ignore
import MiniSearch from "minisearch";
import * as vscode from "vscode";

type FileMiniSearchResult = { relativePath: string; id: string };

export const MAX_FILE_SEARCH_FILES = 50_000;
export const FILE_SEARCH_BATCH_SIZE = 1_000;

/*
  id = file URI
*/
export class FileSearch {
  constructor(private readonly ide: IDE) {
    this.initializeFileSearchState();
  }

  private miniSearch = new MiniSearch<FileMiniSearchResult>({
    fields: ["relativePath", "id"],
    storeFields: ["relativePath", "id"],
    tokenize: (text) =>
      deduplicateArray(
        MiniSearch.getDefault("tokenize")(text).concat(
          splitCamelCaseAndNonAlphaNumeric(text),
        ),
        (a, b) => a === b,
      ),
    searchOptions: {
      prefix: true,
      fuzzy: 2,
      fields: ["relativePath"],
    },
  });
  private async initializeFileSearchState() {
    const results = await walkDirs(this.ide, {
      source: "file search initialization",
    });
    const flatResults = results.flat();
    const cappedResults =
      flatResults.length > MAX_FILE_SEARCH_FILES
        ? flatResults.slice(0, MAX_FILE_SEARCH_FILES)
        : flatResults;

    for (let i = 0; i < cappedResults.length; i += FILE_SEARCH_BATCH_SIZE) {
      const batch = cappedResults
        .slice(i, i + FILE_SEARCH_BATCH_SIZE)
        .map((uri) => ({
          id: uri,
          relativePath: vscode.workspace.asRelativePath(uri),
        }));
      this.miniSearch.addAll(batch);
      // Yield to event loop to keep the extension host and renderer responsive
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  public search(query: string): FileMiniSearchResult[] {
    return this.miniSearch.search(query) as unknown as FileMiniSearchResult[];
  }
}
