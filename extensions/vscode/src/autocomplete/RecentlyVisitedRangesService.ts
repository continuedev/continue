import { IDE } from "core";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "core/autocomplete/snippets/types";
import { PosthogFeatureFlag, Telemetry } from "core/util/posthog";
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
  // Default value, we override in initWithPostHog
  private numSurroundingLines = 20;
  private maxRecentFiles = 3;
  private maxSnippetsPerFile = 3;
  private isEnabled = true;

  constructor(private readonly ide: IDE) {
    this.cache = new LRUCache<
      string,
      Array<AutocompleteCodeSnippet & { timestamp: number }>
    >({
      max: this.maxRecentFiles,
    });

    void this.initWithPostHog();
  }

  private async initWithPostHog() {
    const recentlyVisitedRangesNumSurroundingLines =
      await Telemetry.getValueForFeatureFlag(
        PosthogFeatureFlag.RecentlyVisitedRangesNumSurroundingLines,
      );

    if (recentlyVisitedRangesNumSurroundingLines) {
      this.isEnabled = true;
      this.numSurroundingLines = recentlyVisitedRangesNumSurroundingLines;
    }

    vscode.window.onDidChangeTextEditorSelection(
      this.cacheCurrentSelectionContext,
    );
  }

  private cacheCurrentSelectionContext = async (
    event: vscode.TextEditorSelectionChangeEvent,
  ) => {
    const filepath = event.textEditor.document.uri.toString();
    const line = event.selections[0].active.line;
    const startLine = Math.max(0, line - this.numSurroundingLines);
    const endLine = Math.min(
      line + this.numSurroundingLines,
      event.textEditor.document.lineCount - 1,
    );

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
      const newSnippets = [...existing, snippet]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxSnippetsPerFile);

      this.cache.set(filepath, newSnippets);
    } catch (err) {
      console.error(
        "Error caching recently visited ranges for autocomplete: ",
        err,
      );
      return;
    }
  };

  /**
   * Returns up to {@link maxSnippetsPerFile} snippets from the {@link maxRecentFiles} most recently visited files.
   * Excludes snippets from the currently active file.
   * @returns Array of code snippets from recently visited files
   */
  public getSnippets(): AutocompleteCodeSnippet[] {
    if (!this.isEnabled) {
      return [];
    }

    const currentFilepath =
      vscode.window.activeTextEditor?.document.uri.toString();
    let allSnippets: Array<AutocompleteCodeSnippet & { timestamp: number }> =
      [];

    // Get most recent snippets from each file in cache
    for (const filepath of Array.from(this.cache.keys())) {
      const snippets = (this.cache.get(filepath) || [])
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxSnippetsPerFile);
      allSnippets = [...allSnippets, ...snippets];
    }

    return allSnippets
      .filter((s) => !currentFilepath || (s.filepath !== currentFilepath &&
        // Exclude Continue's own output as it makes it super-hard for users to test the autocomplete feature
        // while looking at the prompts in the Continue's output
        !s.filepath.startsWith("output:extension-output-Continue.continue")))
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ timestamp, ...snippet }) => snippet);
  }
}
