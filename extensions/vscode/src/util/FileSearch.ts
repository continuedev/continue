import { IDE } from "core";
import { walkDir } from "core/indexing/walkDir";
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
    const workspaceDirs = await this.ide.getWorkspaceDirs();

    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        return walkDir(dir, this.ide);
      }),
    );

    this.miniSearch.addAll(
      results.flat().map((file) => ({
        id: file,
        relativePath: vscode.workspace.asRelativePath(file),
      })),
    );
  }

  public search(query: string): FileMiniSearchResult[] {
    return this.miniSearch.search(query) as unknown as FileMiniSearchResult[];
  }
}
