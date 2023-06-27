import * as vscode from "vscode";
import {
  decorationManager,
  showAnswerInTextEditor,
  showGutterSpinner,
  writeAndShowUnitTest,
} from "./decorations";
import {
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  suggestionDownCommand,
  suggestionUpCommand,
  acceptAllSuggestionsCommand,
  rejectAllSuggestionsCommand,
} from "./suggestions";
import * as bridge from "./bridge";
import { debugPanelWebview, setupDebugPanel } from "./debugPanel";
// import { openCapturedTerminal } from "./terminal/terminalEmulator";
import { getRightViewColumn } from "./util/vscode";
import {
  findSuspiciousCode,
  runPythonScript,
  writeUnitTestForFunction,
} from "./bridge";
import { sendTelemetryEvent, TelemetryEvent } from "./telemetry";
import { getLanguageLibrary } from "./languages";
import { SerializedDebugContext } from "./client";
import { addFileSystemToDebugContext } from "./util/util";
import { ideProtocolClient } from "./activation/activate";

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
  "continue.acceptAllSuggestions": acceptAllSuggestionsCommand,
  "continue.rejectAllSuggestions": rejectAllSuggestionsCommand,
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
  "continue.findSuspiciousCode": async (
    debugContext: SerializedDebugContext
  ) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Finding suspicious code",
        cancellable: false,
      },
      async (progress, token) => {
        let suspiciousCode = await findSuspiciousCode(debugContext);
        debugContext.rangesInFiles = suspiciousCode;
        let { filesystem } = addFileSystemToDebugContext(debugContext);
        debugPanelWebview?.postMessage({
          type: "findSuspiciousCode",
          codeLocations: suspiciousCode,
          filesystem,
        });
      }
    );
  },
  "continue.debugTest": async (fileAndFunctionSpecifier: string) => {
    sendTelemetryEvent(TelemetryEvent.AutoDebugThisTest);
    let editor = vscode.window.activeTextEditor;
    if (editor) editor.document.save();
    let { stdout } = await runPythonScript("run_unit_test.py", [
      fileAndFunctionSpecifier,
    ]);
    let traceback = getLanguageLibrary(
      fileAndFunctionSpecifier.split("::")[0]
    ).parseFirstStacktrace(stdout);
    if (!traceback) {
      vscode.window.showInformationMessage("The test passes!");
      return;
    }
    vscode.commands.executeCommand("continue.openContinueGUI").then(() => {
      setTimeout(() => {
        debugPanelWebview?.postMessage({
          type: "traceback",
          value: traceback,
        });
      }, 500);
    });
  },
};

const textEditorCommandsMap: { [command: string]: (...args: any) => {} } = {
  "continue.writeUnitTest": async (editor: vscode.TextEditor) => {
    let position = editor.selection.active;

    let gutterSpinnerKey = showGutterSpinner(editor, position.line);
    try {
      let test = await writeUnitTestForFunction(
        editor.document.fileName,
        position
      );
      writeAndShowUnitTest(editor.document.fileName, test);
    } catch {
    } finally {
      decorationManager.deleteDecoration(gutterSpinnerKey);
    }
  },
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

// async function suggestFixForAllWorkspaceProblems() {
// Something like this, just figure out the loops for diagnostics vs problems
// let problems = vscode.languages.getDiagnostics();
// let codeSuggestions = await Promise.all(problems.map((problem) => {
//   return bridge.suggestFixForProblem(problem[0].fsPath, problem[1]);
// }));
// for (const [uri, diagnostics] of problems) {
//   for (let i = 0; i < diagnostics.length; i++) {
//     let diagnostic = diagnostics[i];
//     let suggestedCode = codeSuggestions[i];
//     // If you're going to do this for a bunch of files at once, it will show the unsaved icon in the tab
//     // BUT it would be better to have a single window to review all edits
//     showSuggestion(uri.fsPath, diagnostic.range, suggestedCode)
//   }
// }
// }
