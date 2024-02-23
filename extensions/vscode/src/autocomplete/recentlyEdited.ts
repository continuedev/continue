import { FileWithContents } from "core";
import { RecentlyEditedRange } from "core/autocomplete/recentlyEdited";
import * as vscode from "vscode";

interface VsCodeRecentlyEditedRange {
  timestamp: number;
  uri: vscode.Uri;
  range: vscode.Range;
}

interface VsCodeRecentlyEditedDocument {
  timestamp: number;
  uri: vscode.Uri;
}

export class RecentlyEditedTracker {
  private static staleTime = 1000 * 60 * 2;
  private static maxRecentlyEditedRanges = 3;
  private recentlyEditedRanges: VsCodeRecentlyEditedRange[] = [];

  private recentlyEditedDocuments: VsCodeRecentlyEditedDocument[] = [];
  private static maxRecentlyEditedDocuments = 10;

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

      const newLength = this.recentlyEditedDocuments.unshift({
        uri: event.document.uri,
        timestamp: Date.now(),
      });
      if (newLength >= RecentlyEditedTracker.maxRecentlyEditedDocuments) {
        this.recentlyEditedDocuments = this.recentlyEditedDocuments.slice(
          0,
          RecentlyEditedTracker.maxRecentlyEditedDocuments
        );
      }
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

  public async getRecentlyEditedDocuments(): Promise<FileWithContents[]> {
    return Promise.all(
      this.recentlyEditedDocuments.map(async (entry) => ({
        filepath: entry.uri.fsPath,
        contents: await vscode.workspace.fs
          .readFile(entry.uri)
          .then((content) => content.toString()),
      }))
    );
  }
}
