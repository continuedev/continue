import { LRUCache } from "lru-cache";
import Parser from "web-tree-sitter";

import { IDE } from "../..";
import {
  getFullLanguageName,
  getParserForFile,
  getQueryForFile,
} from "../../util/treeSitter";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "../snippets/types";

const DEFAULT_NUM_RECENT_FILES = 5;

export class RecentFilesService {
  private cache: LRUCache<string, AutocompleteCodeSnippet[]>;
  private numRecentFiles: number;

  constructor(
    private readonly ide: IDE,
    numRecentFiles = DEFAULT_NUM_RECENT_FILES,
  ) {
    this.numRecentFiles = numRecentFiles;
    this.cache = new LRUCache<string, AutocompleteCodeSnippet[]>({
      max: this.numRecentFiles,
    });

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      void this.onFileOpened(filepath);
    });
  }

  private async onFileOpened(filepath: string) {
    // Remove from cache if already present to update its position
    if (this.cache.has(filepath)) {
      this.cache.delete(filepath);
    }

    // Get function signatures from the file
    const snippets = await this.getFunctionSignatures(filepath);

    if (snippets.length > 0) {
      // Store in cache
      this.cache.set(filepath, snippets);
    }
  }

  private async getFunctionSignatures(
    filepath: string,
  ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];

    const parser = await getParserForFile(filepath);
    if (!parser) {
      return snippets;
    }

    let fileContents: string;
    try {
      fileContents = await this.ide.readFile(filepath);
    } catch (err) {
      // File might have been deleted or inaccessible
      return snippets;
    }

    const ast = parser.parse(fileContents);
    const language = getFullLanguageName(filepath);
    const query = await getQueryForFile(
      filepath,
      `code-snippet-queries/${language}.scm`,
    );

    if (!query) {
      return snippets;
    }

    const matches = query.matches(ast.rootNode);
    if (!matches) {
      return snippets;
    }

    return matches
      .map((match) => this.getSnippetFromMatch(match, filepath))
      .filter(
        (snippet): snippet is AutocompleteCodeSnippet => snippet !== null,
      );
  }

  private getSnippetFromMatch(
    match: Parser.QueryMatch,
    filepath: string,
  ): AutocompleteCodeSnippet | null {
    // We only care about the function signature/declaration, not the body
    for (const { name, node } of match.captures) {
      // Skip function bodies, we only want the signature
      //   if (name.includes("body") || node.type.includes("body")) {
      //     continue;
      //   }

      return {
        filepath,
        content: node.text.trim(),
        type: AutocompleteSnippetType.Code,
      };
    }

    return null;
  }

  public getSnippets(): AutocompleteCodeSnippet[] {
    const allSnippets: AutocompleteCodeSnippet[] = [];
    for (const snippets of this.cache.values()) {
      allSnippets.push(...snippets);
    }
    return allSnippets;
  }
}
