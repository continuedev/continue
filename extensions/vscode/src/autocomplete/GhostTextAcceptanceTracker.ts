// export class CompletionAcceptanceTracker {
//   private static instance: CompletionAcceptanceTracker;
//   private acceptedCompletionIds: Set<string> = new Set();

//   static getInstance(): CompletionAcceptanceTracker {
//     if (!CompletionAcceptanceTracker.instance) {
//       CompletionAcceptanceTracker.instance = new CompletionAcceptanceTracker();
//     }
//     return CompletionAcceptanceTracker.instance;
//   }

//   markGhostTextAccepted(completionId: string) {
//     this.acceptedCompletionIds.add(completionId);

//     // Keep a reasonable history size
//     if (this.acceptedCompletionIds.size > 1) {
//       // Remove the oldest item (using the fact that Sets maintain insertion order)
//       const oldestId = this.acceptedCompletionIds.values().next().value;
//       if (oldestId) {
//         this.acceptedCompletionIds.delete(oldestId);
//       }
//     }
//   }

//   wasCompletionAccepted(completionId: string): boolean {
//     return this.acceptedCompletionIds.has(completionId);
//   }

//   // Add a method to check if the most recent completion was accepted
//   wasRecentCompletionAccepted(): boolean {
//     return this.acceptedCompletionIds.size > 0;
//   }
// }
// In completionAcceptanceTracker.ts
// export class CompletionAcceptanceTracker {
//   private static instance: CompletionAcceptanceTracker;
//   private acceptedCompletionIds: Set<string> = new Set();
//   private currentCompletionId: string | null = null;

//   static getInstance(): CompletionAcceptanceTracker {
//     if (!CompletionAcceptanceTracker.instance) {
//       CompletionAcceptanceTracker.instance = new CompletionAcceptanceTracker();
//     }
//     return CompletionAcceptanceTracker.instance;
//   }

//   setCurrentCompletionId(completionId: string) {
//     this.currentCompletionId = completionId;
//   }

//   markGhostTextAccepted(completionId: string) {
//     console.log("mark");
//     this.acceptedCompletionIds.add(completionId);

//     // Keep a reasonable history size
//     if (this.acceptedCompletionIds.size > 1) {
//       // Remove the oldest item (using the fact that Sets maintain insertion order)
//       const oldestId = this.acceptedCompletionIds.values().next().value;
//       if (oldestId) {
//         this.acceptedCompletionIds.delete(oldestId);
//       }
//     }
//   }

//   wasCompletionAccepted(completionId: string): boolean {
//     return this.acceptedCompletionIds.has(completionId);
//   }

//   isCurrentCompletionAccepted(): boolean {
//     return (
//       this.currentCompletionId !== null &&
//       this.acceptedCompletionIds.has(this.currentCompletionId)
//     );
//   }

//   clearCurrentCompletionId() {
//     this.currentCompletionId = null;
//   }
// }
// New file: extensions/vscode/src/activation/GhostTextAcceptanceTracker.ts
import * as vscode from "vscode";

export interface ExpectedGhostTextAcceptance {
  documentUri: string;
  documentVersion: number;
  text: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export class GhostTextAcceptanceTracker {
  private static instance: GhostTextAcceptanceTracker | undefined;
  private expectedAcceptance: ExpectedGhostTextAcceptance | null = null;

  private constructor() {}

  public static getInstance(): GhostTextAcceptanceTracker {
    if (!GhostTextAcceptanceTracker.instance) {
      GhostTextAcceptanceTracker.instance = new GhostTextAcceptanceTracker();
    }
    return GhostTextAcceptanceTracker.instance;
  }

  public static clearInstance() {
    GhostTextAcceptanceTracker.instance = undefined;
  }

  public setExpectedGhostTextAcceptance(
    document: vscode.TextDocument,
    text: string,
    startPosition: vscode.Position,
  ) {
    // Calculate end position
    const lines = text.split("\n");
    let endLine: number;
    let endCharacter: number;

    if (lines.length > 1) {
      endLine = startPosition.line + lines.length - 1;
      endCharacter = lines[lines.length - 1].length;
    } else {
      endLine = startPosition.line;
      endCharacter = startPosition.character + text.length;
    }

    this.expectedAcceptance = {
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      text,
      startLine: startPosition.line,
      startCharacter: startPosition.character,
      endLine,
      endCharacter,
    };
  }

  public checkGhostTextWasAccepted(
    document: vscode.TextDocument,
    newPosition: vscode.Position,
  ): boolean {
    if (!this.expectedAcceptance) return false;

    // Check document match
    if (this.expectedAcceptance.documentUri !== document.uri.toString()) {
      return false;
    }

    // Check document version (must be newer)
    if (document.version <= this.expectedAcceptance.documentVersion) {
      return false;
    }

    // Check if cursor is at expected end position
    const expectedEndPos = new vscode.Position(
      this.expectedAcceptance.endLine,
      this.expectedAcceptance.endCharacter,
    );

    if (newPosition.isEqual(expectedEndPos)) {
      // The cursor is where we'd expect after accepting the ghost text

      // Verify text was inserted (optional additional check)
      const startPos = new vscode.Position(
        this.expectedAcceptance.startLine,
        this.expectedAcceptance.startCharacter,
      );
      const expectedText = this.expectedAcceptance.text;

      try {
        const actualRange = new vscode.Range(startPos, expectedEndPos);

        const actualText = document.getText(actualRange);

        if (actualText === expectedText) {
          // Clear the expectation
          this.expectedAcceptance = null;
          return true;
        }
      } catch (error) {
        // Range might be invalid, just fall through
      }
    }

    return false;
  }
}
