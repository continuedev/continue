import { IDE } from "core";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippetType,
} from "core/autocomplete/snippets/types";
import { isSecurityConcern } from "core/indexing/ignore";
import { PosthogFeatureFlag, Telemetry } from "core/util/posthog";
import { LRUCache } from "lru-cache";
import * as vscode from "vscode";

interface RecentlyVisitedLine {
  line: number;
  timestamp: number;
}

type RecentlyVisitedRangeSnippet = AutocompleteCodeSnippet & {
  timestamp: number;
};

/**
 * Service to keep track of recently visited ranges in files.
 */
export class RecentlyVisitedRangesService {
  private cache: LRUCache<string, Array<RecentlyVisitedLine>>;
  // Default value, we override in initWithPostHog
  private numSurroundingLines = 20;
  private maxRecentFiles = 3;
  private maxSnippetsPerFile = 3; // TODO - might have less if
  private isEnabled = true;

  constructor(private readonly ide: IDE) {
    this.cache = new LRUCache<string, Array<RecentlyVisitedLine>>({
      max: this.maxRecentFiles,
    });

    void this.initWithPostHog();
  }

  private async initWithPostHog() {
    const recentlyVisitedRangesNumSurroundingLines =
      await Telemetry.getValueForFeatureFlag(
        PosthogFeatureFlag.RecentlyVisitedRangesNumSurroundingLines,
      );

    if (true) {
      this.isEnabled = true;
      this.numSurroundingLines = recentlyVisitedRangesNumSurroundingLines;
      vscode.window.onDidChangeTextEditorSelection(
        this.cacheCurrentSelectionContext,
      );
    } else {
      this.isEnabled = false;
    }
  }

  private securityChecks = new Map<string, boolean>();

  private cacheCurrentSelectionContext = async (
    event: vscode.TextEditorSelectionChangeEvent,
  ) => {
    console.log("changed");
    let securityCheck = this.securityChecks.get(
      event.textEditor.document.fileName,
    );
    if (securityCheck === null) {
      securityCheck = isSecurityConcern(event.textEditor.document.fileName);
      this.securityChecks.set(
        event.textEditor.document.fileName,
        securityCheck,
      );
    }
    if (securityCheck) {
      return;
    }

    const filepath = event.textEditor.document.uri.toString();

    // Exclude extension output panels
    if (filepath.includes("output:extension-output")) {
      // Just continue output: "output:extension-output-Continue.continue"
      return;
    }

    const existing = this.cache.get(filepath) || [];
    if (existing.length >= this.maxSnippetsPerFile) {
      existing.pop();
    }
    existing.unshift({
      timestamp: Date.now(),
      line: event.selections[0].active.line,
    });

    this.cache.set(filepath, existing);
  };

  /**
   * Returns up to {@link maxSnippetsPerFile} snippets from the {@link maxRecentFiles} most recently visited files.
   * Excludes snippets from the currently active file.
   * @returns Array of code snippets from recently visited files
   */
  public async getSnippets(): Promise<AutocompleteCodeSnippet[]> {
    if (!this.isEnabled) {
      return [];
    }

    const currentFileUri =
      vscode.window.activeTextEditor?.document.uri.toString();

    const files = Array.from(this.cache.keys()).filter(
      (f) => f !== currentFileUri,
    );
    const fileReads = await Promise.allSettled(
      files.map(async (uri) => {
        console.log(
          `read file - RecentlyVisitedRangesService cacheCurrentSelectionContext - ${uri}`,
        );
        const contents = await this.ide.readFile(uri);
        const lines = contents.split("\n");
        return {
          uri,
          lines,
        };
      }),
    );

    const successfulReads = fileReads
      .filter((fr) => fr.status === "fulfilled")
      .map((fr) => fr.value);

    const snippets: RecentlyVisitedRangeSnippet[] = [];
    for (const file of successfulReads) {
      const recentVisits = this.cache.get(file.uri);
      if (recentVisits) {
        for (const recentVisit of recentVisits) {
          const startLine = Math.max(
            0,
            recentVisit.line - this.numSurroundingLines,
          );
          const endLine = Math.min(
            recentVisit.line + this.numSurroundingLines,
            file.lines.length - 1,
          );
          const relevantLines = file.lines
            .slice(startLine, endLine + 1)
            .join("\n")
            .trim();

          const snippet: RecentlyVisitedRangeSnippet = {
            filepath: file.uri,
            content: relevantLines,
            type: AutocompleteSnippetType.Code,
            timestamp: recentVisit.timestamp,
          };
          snippets.push(snippet);
        }
      }
    }

    return snippets
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ timestamp, ...snippet }) => snippet);
  }
}
