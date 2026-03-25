import { IDE } from "core";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "core/autocomplete/snippets/types";
import { isSecurityConcern } from "core/indexing/ignore";
import { LRUCache } from "lru-cache";
import * as vscode from "vscode";

interface VisitedPosition {
  line: number;
  timestamp: number;
}

/**
 * Service to keep track of recently visited ranges in files.
 * Stores only cursor positions on selection change, deferring file reads
 * to getSnippets() time to avoid expensive I/O on every cursor move.
 */
export class RecentlyVisitedRangesService {
  private cache: LRUCache<string, VisitedPosition[]>;
  private numSurroundingLines = 20;
  private maxRecentFiles = 3;
  private maxSnippetsPerFile = 3;
  private disposable: vscode.Disposable | undefined;

  constructor(private readonly ide: IDE) {
    this.cache = new LRUCache<string, VisitedPosition[]>({
      max: this.maxRecentFiles,
    });

    this.disposable = vscode.window.onDidChangeTextEditorSelection(
      this.cacheCurrentSelectionPosition,
    );
  }

  private cacheCurrentSelectionPosition = (
    event: vscode.TextEditorSelectionChangeEvent,
  ) => {
    const fsPath = event.textEditor.document.fileName;
    if (isSecurityConcern(fsPath)) {
      return;
    }
    const filepath = event.textEditor.document.uri.toString();
    const line = event.selections[0].active.line;

    const position: VisitedPosition = {
      line,
      timestamp: Date.now(),
    };

    const existing = this.cache.get(filepath) || [];
    const newPositions = [...existing, position]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.maxSnippetsPerFile);

    this.cache.set(filepath, newPositions);
  };

  /**
   * Returns up to {@link maxSnippetsPerFile} snippets from the {@link maxRecentFiles} most recently visited files.
   * Excludes snippets from the currently active file.
   * File contents are read lazily here rather than on every cursor move.
   * @returns Array of code snippets from recently visited files
   */
  public async getSnippets(): Promise<AutocompleteCodeSnippet[]> {
    const currentFilepath =
      vscode.window.activeTextEditor?.document.uri.toString();

    const allPositions: Array<{
      filepath: string;
      position: VisitedPosition;
    }> = [];

    for (const filepath of Array.from(this.cache.keys())) {
      if (
        filepath === currentFilepath ||
        filepath.startsWith("output:extension-output-Continue.continue")
      ) {
        continue;
      }

      const positions = (this.cache.get(filepath) || [])
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxSnippetsPerFile);

      for (const position of positions) {
        allPositions.push({ filepath, position });
      }
    }

    // Sort all positions by timestamp, most recent first
    allPositions.sort((a, b) => b.position.timestamp - a.position.timestamp);

    const snippets: AutocompleteCodeSnippet[] = [];

    for (const { filepath, position } of allPositions) {
      try {
        const fileContents = await this.ide.readFile(filepath);
        const lines = fileContents.split("\n");
        const startLine = Math.max(0, position.line - this.numSurroundingLines);
        const endLine = Math.min(
          position.line + this.numSurroundingLines,
          lines.length - 1,
        );

        const relevantLines = lines
          .slice(startLine, endLine + 1)
          .join("\n")
          .trim();

        if (relevantLines) {
          snippets.push({
            filepath,
            content: relevantLines,
            type: AutocompleteSnippetType.Code,
          });
        }
      } catch {
        // File may have been deleted or become inaccessible
        continue;
      }
    }

    return snippets;
  }

  public dispose(): void {
    this.disposable?.dispose();
  }
}
