import { RecentlyEditedRange } from "core/autocomplete/recentlyEdited";
import * as vscode from "vscode";

interface VsCodeRecentlyEditedRange {
  timestamp: number;
  uri: vscode.Uri;
  range: vscode.Range;
}

export class RecentlyEditedTracker {
  private static staleTime = 1000 * 60 * 2;
  private static maxRecentlyEditedRanges = 3;
  private recentlyEditedRanges: VsCodeRecentlyEditedRange[] = [];

  constructor() {
    vscode.workspace.onDidChangeTextDocument((event) => {
      event.contentChanges.forEach((change) => {
        const editedRange = {
          uri: event.document.uri,
          range: change.range,
          timestamp: Date.now(),
        };
        const newLength = this.recentlyEditedRanges.unshift(editedRange);
        if (newLength >= RecentlyEditedTracker.maxRecentlyEditedRanges) {
          this.recentlyEditedRanges = this.recentlyEditedRanges.slice(
            0,
            RecentlyEditedTracker.maxRecentlyEditedRanges
          );
        }
      });
    });

    setInterval(() => {
      this.removeOldEntries();
    }, 1000 * 15);
  }

  private removeOldEntries() {
    this.recentlyEditedRanges = this.recentlyEditedRanges.filter(
      (entry) => entry.timestamp > Date.now() - RecentlyEditedTracker.staleTime
    );
  }

  public async getRecentlyEditedRanges(): Promise<RecentlyEditedRange[]> {
    return Promise.all(
      this.recentlyEditedRanges.map(async (entry) => ({
        timestamp: entry.timestamp,
        filepath: entry.uri.fsPath,
        contents: await vscode.workspace.fs
          .readFile(entry.uri)
          .then((content) => content.toString()),
        range: {
          start: {
            line: entry.range.start.line,
            character: entry.range.start.character,
          },
          end: {
            line: entry.range.end.line,
            character: entry.range.end.character,
          },
        },
      }))
    );
  }
}
