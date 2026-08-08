import * as vscode from "vscode";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "../activation/SelectionChangeManager";

export interface ExpectedGhostTextAcceptance {
  documentUri: string;
  documentVersion: number;
  text: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

/**
 * This singleton tracks whether a given ghost text is accepted or not.
 * We need this because there is no clean way of determining if a ghost text has been accepted outside of vscode command callback.
 * The above mentioned callback is not viable because it's too slow.
 * We need a way to reject model predictions on cursor movement, but cursor can move due to many reasons -- one being accepting a ghost text.
 * We need to differentiate the ghost text acceptance from a deliberate cursor movement to reject the completion.
 * The cursor movement event listener fires much before the vscode command callback, so the chain of edits often breaks when cursor moves due to accepting a ghost text.
 * This is not what we want, as we want to keep the current chain of edits alive when the user accepts the completion.
 */
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

  public registerSelectionChangeHandler(): void {
    const manager = SelectionChangeManager.getInstance();

    manager.registerListener(
      "ghostTextTracker",
      async (e, state) => {
        if (!state.document || !state.cursorPosition) {
          return false;
        }

        const wasGhostTextAccepted = this.checkGhostTextWasAccepted(
          state.document,
          state.cursorPosition,
        );

        if (wasGhostTextAccepted) {
          console.debug(
            "GhostTextAcceptanceTracker: ghost text was accepted, preserving chain",
          );
          return true;
        }

        return false;
      },
      HandlerPriority.HIGH,
    );
  }
}
