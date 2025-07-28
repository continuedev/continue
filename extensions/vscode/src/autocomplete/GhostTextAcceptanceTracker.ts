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

    // Check document match.
    if (this.expectedAcceptance.documentUri !== document.uri.toString()) {
      return false;
    }

    // Check document version (must be newer).
    if (document.version <= this.expectedAcceptance.documentVersion) {
      return false;
    }

    // Check if cursor is at expected end position.
    const expectedEndPos = new vscode.Position(
      this.expectedAcceptance.endLine,
      this.expectedAcceptance.endCharacter,
    );

    if (newPosition.isEqual(expectedEndPos)) {
      // The cursor is where we'd expect after accepting the ghost text.

      // Verify text was inserted (optional additional check).
      const startPos = new vscode.Position(
        this.expectedAcceptance.startLine,
        this.expectedAcceptance.startCharacter,
      );
      const expectedText = this.expectedAcceptance.text;

      try {
        const actualRange = new vscode.Range(startPos, expectedEndPos);

        const actualText = document.getText(actualRange);

        if (actualText === expectedText) {
          // Clear the expectation.
          this.expectedAcceptance = null;
          return true;
        }
      } catch (error) {
        // Range might be invalid, just fall through.
      }
    }

    return false;
  }
}
