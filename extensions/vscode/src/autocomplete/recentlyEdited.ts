import { RecentlyEditedRange } from "core/autocomplete/recentlyEdited";
import { RangeInFileWithContents } from "core/commands/util";
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
      if (event.document.uri.scheme !== "file") {
        return;
      }
      event.contentChanges.forEach((change) => {
        const editedRange = {
          uri: event.document.uri,
          range: new vscode.Range(
            new vscode.Position(change.range.start.line, 0),
            new vscode.Position(change.range.end.line + 1, 0),
          ),
          timestamp: Date.now(),
        };
        this.insertRange(editedRange);
      });

      this.insertDocument(event.document.uri);
    });

    setInterval(() => {
      this.removeOldEntries();
    }, 1000 * 15);
  }

  private insertRange(editedRange: VsCodeRecentlyEditedRange): void {
    // Check for overlap with any existing ranges
    for (let i = 0; i < this.recentlyEditedRanges.length; i++) {
      let range = this.recentlyEditedRanges[i];
      if (range.range.intersection(editedRange.range)) {
        range = {
          ...range,
          range: range.range.union(editedRange.range),
        };
        return;
      }
    }

    // Otherwise, just add the new and maintain max size
    const newLength = this.recentlyEditedRanges.unshift(editedRange);
    if (newLength >= RecentlyEditedTracker.maxRecentlyEditedRanges) {
      this.recentlyEditedRanges = this.recentlyEditedRanges.slice(
        0,
        RecentlyEditedTracker.maxRecentlyEditedRanges,
      );
    }
  }

  private insertDocument(uri: vscode.Uri): void {
    // Don't add a duplicate
    if (this.recentlyEditedDocuments.some((doc) => doc.uri === uri)) {
      return;
    }

    const newLength = this.recentlyEditedDocuments.unshift({
      uri,
      timestamp: Date.now(),
    });
    if (newLength >= RecentlyEditedTracker.maxRecentlyEditedDocuments) {
      this.recentlyEditedDocuments = this.recentlyEditedDocuments.slice(
        0,
        RecentlyEditedTracker.maxRecentlyEditedDocuments,
      );
    }
  }

  private removeOldEntries() {
    this.recentlyEditedRanges = this.recentlyEditedRanges.filter(
      (entry) => entry.timestamp > Date.now() - RecentlyEditedTracker.staleTime,
    );
  }

  public async getRecentlyEditedRanges(): Promise<RecentlyEditedRange[]> {
    const results = await Promise.all(
      this.recentlyEditedRanges.map(async (entry) => {
        try {
          const contents = await vscode.workspace.fs
            .readFile(entry.uri)
            .then((content) =>
              content
                .toString()
                .split("\n")
                .slice(entry.range.start.line, entry.range.end.line + 1)
                .join("\n"),
            );
          return {
            timestamp: entry.timestamp,
            filepath: entry.uri.fsPath,
            contents,
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
          };
        } catch (e) {
          return null;
        }
      }),
    );
    return results.filter((result) => result !== null) as any;
  }

  public async getRecentlyEditedDocuments(): Promise<
    RangeInFileWithContents[]
  > {
    const results = await Promise.all(
      this.recentlyEditedDocuments.map(async (entry) => {
        try {
          const contents = await vscode.workspace.fs
            .readFile(entry.uri)
            .then((content) => content.toString());
          const lines = contents.split("\n");

          return {
            filepath: entry.uri.fsPath,
            contents,
            range: {
              start: { line: 0, character: 0 },
              end: {
                line: lines.length - 1,
                character: lines[lines.length - 1].length,
              },
            },
          };
        } catch (e) {
          return null;
        }
      }),
    );

    return results.filter((result) => result !== null) as any;
  }
}
