import * as vscode from "vscode";
import {
  decorationManager,
  showAnswerInTextEditor,
  showGutterSpinner,
} from "./decorations";
import {
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  suggestionDownCommand,
  suggestionUpCommand,
  acceptAllSuggestionsCommand,
  rejectAllSuggestionsCommand,
} from "./suggestions";

import { acceptDiffCommand, rejectDiffCommand } from "./diffs";
import * as bridge from "./bridge";
import { debugPanelWebview } from "./debugPanel";
import { ideProtocolClient } from "./activation/activate";

let focusedOnContinueInput = false;

export const setFocusedOnContinueInput = (value: boolean) => {
  focusedOnContinueInput = value;
};

// Copy everything over from extension.ts
const commandsMap: { [command: string]: (...args: any) => any } = {
  "continue.suggestionDown": suggestionDownCommand,
  "continue.suggestionUp": suggestionUpCommand,
  "continue.acceptSuggestion": acceptSuggestionCommand,
  "continue.rejectSuggestion": rejectSuggestionCommand,
  "continue.acceptDiff": acceptDiffCommand,
  "continue.rejectDiff": rejectDiffCommand,
  "continue.acceptAllSuggestions": acceptAllSuggestionsCommand,
  "continue.rejectAllSuggestions": rejectAllSuggestionsCommand,
  "continue.quickFix": async (message: string, code: string, edit: boolean) => {
    ideProtocolClient.sendMainUserInput(
      `${
        edit ? "/edit " : ""
      }${code}\n\nHow do I fix this problem in the above code?: ${message}`
    );
  },
  "continue.focusContinueInput": async () => {
    if (focusedOnContinueInput) {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    } else {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
      debugPanelWebview?.postMessage({
        type: "focusContinueInput",
      });
    }
    focusedOnContinueInput = !focusedOnContinueInput;
  },
  "continue.quickTextEntry": async () => {
    const text = await vscode.window.showInputBox({
      placeHolder:
        "Ask a question, give instructions, or enter a slash command",
      title: "Continue Quick Input",
    });
    if (text) {
      ideProtocolClient.sendMainUserInput(text);
    }
  },
};

export function registerAllCommands(context: vscode.ExtensionContext) {
  for (const [command, callback] of Object.entries(commandsMap)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  }
}
