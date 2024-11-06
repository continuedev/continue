import { IDE } from "core";
import { walkDir } from "core/indexing/walkDir";
// @ts-ignore
import MiniSearch from "minisearch";
import * as vscode from "vscode";

type FileMiniSearchResult = { filename: string };

export class FileSearch {
  constructor(private readonly ide: IDE) {
    this.initializeFileSearchState();
  }

  private miniSearch = new MiniSearch<FileMiniSearchResult>({
    fields: ["filename"],
    storeFields: ["filename"],
    searchOptions: {
      prefix: true,
      fuzzy: 2,
    },
  });
  private async initializeFileSearchState() {
    const workspaceDirs = await this.ide.getWorkspaceDirs();

    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        return walkDir(dir, this.ide);
      }),
    );

    const filenames = results.flat().map((file) => ({
      id: file,
      filename: vscode.workspace.asRelativePath(file),
    }));

    this.miniSearch.addAll(filenames);
  }

  public search(query: string): FileMiniSearchResult[] {
    return this.miniSearch.search(query) as unknown as FileMiniSearchResult[];
  }
}
