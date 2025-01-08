import { IDE } from "core";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "core/autocomplete/snippets/types";
import { LRUCache } from "lru-cache";
import * as vscode from "vscode";

/**
 * Service to keep track of recently visited ranges in files.
 */
export class RecentlyVisitedRangesService {
  private cache: LRUCache<
    string,
    Array<AutocompleteCodeSnippet & { timestamp: number }>
  >;
  private numSurroundingLines = 5;
  private maxRecentFiles = 3;
  private maxSnippetsPerFile = 3;

  constructor(private readonly ide: IDE) {
    this.cache = new LRUCache<
      string,
      Array<AutocompleteCodeSnippet & { timestamp: number }>
    >({
      max: this.maxRecentFiles,
    });

    // Subscribe to cursor movement
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const filepath = event.textEditor.document.uri.fsPath;
      const line = event.selections[0].active.line;
      void this.onCursorMoved(filepath, line);
    });
  }

  private async onCursorMoved(filepath: string, line: number) {
    const startLine = Math.max(0, line - this.numSurroundingLines);
    const endLine = line + this.numSurroundingLines;

    try {
      const fileContents = await this.ide.readFile(filepath);
      const lines = fileContents.split("\n");
      const relevantLines = lines
        .slice(startLine, endLine + 1)
        .join("\n")
        .trim();

      const snippet: AutocompleteCodeSnippet & { timestamp: number } = {
        filepath,
        content: relevantLines,
        type: AutocompleteSnippetType.Code,
        timestamp: Date.now(),
      };

      const existing = this.cache.get(filepath) || [];
      this.cache.set(filepath, [...existing, snippet]);
    } catch (err) {
      console.log(
        "Error caching recently visited ranges for autocomplete",
        err,
      );
      return;
    }
  }

  /**
   * Returns up to {@link maxSnippetsPerFile} snippets from the {@link maxRecentFiles} most recently visited files.
   * Excludes snippets from the currently active file.
   * @returns Array of code snippets from recently visited files
   */
  public getSnippets(): AutocompleteCodeSnippet[] {
    const currentFilepath = vscode.window.activeTextEditor?.document.uri.fsPath;
    const allSnippets: Array<AutocompleteCodeSnippet & { timestamp: number }> =
      [];

    // Get most recent snippets from each file in cache
    for (const filepath of this.cache.keys()) {
      const snippets = (this.cache.get(filepath) || [])
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxSnippetsPerFile);
      allSnippets.push(...snippets);
    }

    return allSnippets
      .filter((s) => !currentFilepath || s.filepath !== currentFilepath)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ timestamp, ...snippet }) => snippet);
  }
}
