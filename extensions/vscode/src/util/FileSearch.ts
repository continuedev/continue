import { IDE } from "core";
import { walkDirs } from "core/indexing/walkDir";
// @ts-ignore
import MiniSearch from "minisearch";
import * as vscode from "vscode";

type FileMiniSearchResult = { relativePath: string; id: string };

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
    this.miniSearch.addAll(
      results.flat().map((uri) => ({
        id: uri,
        relativePath: vscode.workspace.asRelativePath(uri),
      })),
    );
  }

  public search(query: string): FileMiniSearchResult[] {
    return this.miniSearch.search(query) as unknown as FileMiniSearchResult[];
  }
}
