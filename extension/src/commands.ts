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
} from "./suggestions";
import * as bridge from "./bridge";
import { debugPanelWebview } from "./debugPanel";
import { writeUnitTestForFunction } from "./bridge";
import { sendTelemetryEvent, TelemetryEvent } from "./telemetry";

// Copy everything over from extension.ts
const commandsMap: { [command: string]: (...args: any) => any } = {
  "continue.askQuestion": (data: any, webviewView: vscode.WebviewView) => {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    answerQuestion(
      data.question,
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      webviewView.webview
    );
  },
  "continue.askQuestionFromInput": () => {
    vscode.window
      .showInputBox({ placeHolder: "Ask away!" })
      .then((question) => {
        if (!question || !vscode.workspace.workspaceFolders) {
          return;
        }

        sendTelemetryEvent(TelemetryEvent.UniversalPromptQuery, {
          query: question,
        });

        answerQuestion(
          question,
          vscode.workspace.workspaceFolders[0].uri.fsPath
        );
      });
  },
  "continue.suggestionDown": suggestionDownCommand,
  "continue.suggestionUp": suggestionUpCommand,
  "continue.acceptSuggestion": acceptSuggestionCommand,
  "continue.rejectSuggestion": rejectSuggestionCommand,
  "continue.focusContinueInput": async () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    debugPanelWebview?.postMessage({
      type: "focusContinueInput",
    });
  },
  "continue.openCapturedTerminal": () => {
    // Happens in webview resolution function
    // openCapturedTerminal();
  },
};

const textEditorCommandsMap: { [command: string]: (...args: any) => {} } = {
  "continue.writeDocstring": async (editor: vscode.TextEditor, _) => {
    sendTelemetryEvent(TelemetryEvent.GenerateDocstring);
    let gutterSpinnerKey = showGutterSpinner(
      editor,
      editor.selection.active.line
    );

    const { lineno, docstring } = await bridge.writeDocstringForFunction(
      editor.document.fileName,
      editor.selection.active
    );
    // Can't use the edit given above after an async call
    editor.edit((edit) => {
      edit.insert(new vscode.Position(lineno, 0), docstring);
      decorationManager.deleteDecoration(gutterSpinnerKey);
    });
  },
};

export function registerAllCommands(context: vscode.ExtensionContext) {
  for (const [command, callback] of Object.entries(commandsMap)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  }

  for (const [command, callback] of Object.entries(textEditorCommandsMap)) {
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(command, callback)
    );
  }
}

async function answerQuestion(
  question: string,
  workspacePath: string,
  webview: vscode.Webview | undefined = undefined
) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Anwering question...",
      cancellable: false,
    },
    async (progress, token) => {
      try {
        let resp = await bridge.askQuestion(question, workspacePath);
        // Send the answer back to the webview
        if (webview) {
          webview.postMessage({
            type: "answerQuestion",
            answer: resp.answer,
          });
        }
        showAnswerInTextEditor(resp.filename, resp.range, resp.answer);
      } catch (error: any) {
        if (webview) {
          webview.postMessage({
            type: "answerQuestion",
            answer: error,
          });
        }
      }
    }
  );
}
