import * as vscode from "vscode";
import { extensionContext } from "./activation/activate";

export function getContinueServerUrl() {
  // If in debug mode, always use 8001
  if (
    extensionContext &&
    extensionContext.extensionMode === vscode.ExtensionMode.Development
  ) {
    return "http://localhost:8001";
  }
  return (
    vscode.workspace.getConfiguration("continue").get<string>("serverUrl") ||
    "http://localhost:65432"
  );
}
