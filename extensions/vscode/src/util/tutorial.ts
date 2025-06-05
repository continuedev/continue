import { IDE } from "core";
import * as vscode from "vscode";

import { getExtensionUri } from "./vscode";

const TUTORIAL_FILE_NAME = "continue_tutorial.py";
export function getTutorialUri(): vscode.Uri {
  return vscode.Uri.joinPath(getExtensionUri(), TUTORIAL_FILE_NAME);
}

export function isTutorialFile(uri: vscode.Uri) {
  return uri.path.endsWith(TUTORIAL_FILE_NAME);
}

export async function showTutorial(ide: IDE) {
  const tutorialUri = getTutorialUri();
  // Ensure keyboard shortcuts match OS
  if (process.platform !== "darwin") {
    let tutorialContent = await ide.readFile(tutorialUri.toString());
    tutorialContent = tutorialContent
      .replaceAll("[Cmd + L]", "[Ctrl + L]")
      .replaceAll("[Cmd + Shift + L]", "[Ctrl + Shift + L]")
      .replaceAll("[Cmd + I]", "[Ctrl + I]")
      .replaceAll("⌘", "^");

    await ide.writeFile(tutorialUri.toString(), tutorialContent);
  }

  const doc = await vscode.workspace.openTextDocument(tutorialUri);
  await vscode.window.showTextDocument(doc, {
    preview: false,
  });
}
