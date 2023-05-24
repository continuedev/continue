import * as vscode from "vscode";
import { sendTelemetryEvent, TelemetryEvent } from "./telemetry";
import { openEditorAndRevealRange } from "./util/vscode";
import { translate, readFileAtRange } from "./util/vscode";

export interface SuggestionRanges {
  oldRange: vscode.Range;
  newRange: vscode.Range;
  newSelected: boolean;
}

/* Keyed by editor.document.uri.toString() */
export const editorToSuggestions: Map<
  string, // URI of file
  SuggestionRanges[]
> = new Map();
export let currentSuggestion: Map<string, number> = new Map(); // Map from editor URI to index of current SuggestionRanges in editorToSuggestions

// When tab is reopened, rerender the decorations:
vscode.window.onDidChangeActiveTextEditor((editor) => {
  if (!editor) return;
  rerenderDecorations(editor.document.uri.toString());
});
vscode.workspace.onDidOpenTextDocument((doc) => {
  rerenderDecorations(doc.uri.toString());
});

let newDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgb(0, 255, 0, 0.1)",
  isWholeLine: true,
});
let oldDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgb(255, 0, 0, 0.1)",
  isWholeLine: true,
  cursor: "pointer",
});
let newSelDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgb(0, 255, 0, 0.25)",
  isWholeLine: true,
  after: {
    contentText: "Press ctrl+shift+enter to accept",
    margin: "0 0 0 1em",
  },
});
let oldSelDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgb(255, 0, 0, 0.25)",
  isWholeLine: true,
  after: {
    contentText: "Press ctrl+shift+enter to reject",
    margin: "0 0 0 1em",
  },
});

export function rerenderDecorations(editorUri: string) {
  let suggestions = editorToSuggestions.get(editorUri);
  let idx = currentSuggestion.get(editorUri);
  let editor = vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === editorUri
  );
  if (!suggestions || !editor) return;

  let olds: vscode.Range[] = [],
    news: vscode.Range[] = [],
    oldSels: vscode.Range[] = [],
    newSels: vscode.Range[] = [];
  for (let i = 0; i < suggestions.length; i++) {
    let suggestion = suggestions[i];
    if (typeof idx != "undefined" && idx === i) {
      if (suggestion.newSelected) {
        olds.push(suggestion.oldRange);
        newSels.push(suggestion.newRange);
      } else {
        oldSels.push(suggestion.oldRange);
        news.push(suggestion.newRange);
      }
    } else {
      olds.push(suggestion.oldRange);
      news.push(suggestion.newRange);
    }
  }
  editor.setDecorations(oldDecorationType, olds);
  editor.setDecorations(newDecorationType, news);
  editor.setDecorations(oldSelDecorationType, oldSels);
  editor.setDecorations(newSelDecorationType, newSels);

  // Reveal the range in the editor
  if (idx === undefined) return;
  editor.revealRange(
    suggestions[idx].newRange,
    vscode.TextEditorRevealType.Default
  );
}

export function suggestionDownCommand() {
  let editor = vscode.window.activeTextEditor;
  if (!editor) return;
  let editorUri = editor.document.uri.toString();
  let suggestions = editorToSuggestions.get(editorUri);
  let idx = currentSuggestion.get(editorUri);
  if (!suggestions || idx === undefined) return;

  let suggestion = suggestions[idx];
  if (!suggestion.newSelected) {
    suggestion.newSelected = true;
  } else if (idx + 1 < suggestions.length) {
    currentSuggestion.set(editorUri, idx + 1);
  } else return;
  rerenderDecorations(editorUri);
}

export function suggestionUpCommand() {
  let editor = vscode.window.activeTextEditor;
  if (!editor) return;
  let editorUri = editor.document.uri.toString();
  let suggestions = editorToSuggestions.get(editorUri);
  let idx = currentSuggestion.get(editorUri);
  if (!suggestions || idx === undefined) return;

  let suggestion = suggestions[idx];
  if (suggestion.newSelected) {
    suggestion.newSelected = false;
  } else if (idx > 0) {
    currentSuggestion.set(editorUri, idx - 1);
  } else return;
  rerenderDecorations(editorUri);
}

type SuggestionSelectionOption = "old" | "new" | "selected";
function selectSuggestion(
  accept: SuggestionSelectionOption,
  key: SuggestionRanges | null = null
) {
  let editor = vscode.window.activeTextEditor;
  if (!editor) return;
  let editorUri = editor.document.uri.toString();
  let suggestions = editorToSuggestions.get(editorUri);

  if (!suggestions) return;

  let idx: number | undefined;
  if (key) {
    // Use the key to find a specific suggestion
    for (let i = 0; i < suggestions.length; i++) {
      if (
        suggestions[i].newRange === key.newRange &&
        suggestions[i].oldRange === key.oldRange
      ) {
        // Don't include newSelected in the comparison, because it can change
        idx = i;
        break;
      }
    }
  } else {
    // Otherwise, use the current suggestion
    idx = currentSuggestion.get(editorUri);
  }
  if (idx === undefined) return;

  let [suggestion] = suggestions.splice(idx, 1);

  var rangeToDelete: vscode.Range;
  switch (accept) {
    case "old":
      rangeToDelete = suggestion.newRange;
      break;
    case "new":
      rangeToDelete = suggestion.oldRange;
      break;
    case "selected":
      rangeToDelete = suggestion.newSelected
        ? suggestion.oldRange
        : suggestion.newRange;
  }

  rangeToDelete = new vscode.Range(
    rangeToDelete.start,
    new vscode.Position(rangeToDelete.end.line + 1, 0)
  );
  editor.edit((edit) => {
    edit.delete(rangeToDelete);
  });

  // Shift the below suggestions up
  let linesToShift = rangeToDelete.end.line - rangeToDelete.start.line;
  for (let below of suggestions) {
    // Assumes there should be no crossover between suggestions. Might want to enforce this.
    if (
      below.oldRange.union(below.newRange).start.line >
      suggestion.oldRange.union(suggestion.newRange).start.line
    ) {
      below.oldRange = translate(below.oldRange, -linesToShift);
      below.newRange = translate(below.newRange, -linesToShift);
    }
  }

  if (suggestions.length === 0) {
    currentSuggestion.delete(editorUri);
  } else {
    currentSuggestion.set(editorUri, Math.min(idx, suggestions.length - 1));
  }
  rerenderDecorations(editorUri);
}

export function acceptSuggestionCommand(key: SuggestionRanges | null = null) {
  sendTelemetryEvent(TelemetryEvent.SuggestionAccepted);
  selectSuggestion("selected", key);
}

export async function rejectSuggestionCommand(
  key: SuggestionRanges | null = null
) {
  sendTelemetryEvent(TelemetryEvent.SuggestionRejected);
  selectSuggestion("old", key);
}

export async function showSuggestion(
  editorFilename: string,
  range: vscode.Range,
  suggestion: string
): Promise<boolean> {
  let existingCode = await readFileAtRange(
    new vscode.Range(range.start, range.end),
    editorFilename
  );

  // If any of the outside lines are the same, don't repeat them in the suggestion
  let slines = suggestion.split("\n");
  let elines = existingCode.split("\n");
  let linesRemovedBefore = 0;
  let linesRemovedAfter = 0;
  while (slines.length > 0 && elines.length > 0 && slines[0] === elines[0]) {
    slines.shift();
    elines.shift();
    linesRemovedBefore++;
  }

  while (
    slines.length > 0 &&
    elines.length > 0 &&
    slines[slines.length - 1] === elines[elines.length - 1]
  ) {
    slines.pop();
    elines.pop();
    linesRemovedAfter++;
  }

  suggestion = slines.join("\n");
  if (suggestion === "") return Promise.resolve(false); // Don't even make a suggestion if they are exactly the same

  range = new vscode.Range(
    new vscode.Position(range.start.line + linesRemovedBefore, 0),
    new vscode.Position(
      range.end.line - linesRemovedAfter,
      elines.at(-1)?.length || 0
    )
  );

  let editor = await openEditorAndRevealRange(editorFilename, range);
  if (!editor) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    editor!
      .edit((edit) => {
        if (range.end.line + 1 >= editor.document.lineCount) {
          suggestion = "\n" + suggestion;
        }
        edit.insert(
          new vscode.Position(range.end.line + 1, 0),
          suggestion + "\n"
        );
      })
      .then(
        (success) => {
          if (success) {
            let suggestionRange = new vscode.Range(
              new vscode.Position(range.end.line + 1, 0),
              new vscode.Position(
                range.end.line + suggestion.split("\n").length,
                0
              )
            );

            const filename = editor!.document.uri.toString();
            if (editorToSuggestions.has(filename)) {
              let suggestions = editorToSuggestions.get(filename)!;
              suggestions.push({
                oldRange: range,
                newRange: suggestionRange,
                newSelected: true,
              });
              editorToSuggestions.set(filename, suggestions);
              currentSuggestion.set(filename, suggestions.length - 1);
            } else {
              editorToSuggestions.set(filename, [
                {
                  oldRange: range,
                  newRange: suggestionRange,
                  newSelected: true,
                },
              ]);
              currentSuggestion.set(filename, 0);
            }

            rerenderDecorations(filename);
          }
          resolve(success);
        },
        (reason) => reject(reason)
      );
  });
}
