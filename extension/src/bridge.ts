import * as vscode from "vscode";

export function getContinueServerUrl() {
  // Passed in from launch.json
  if (process.env.CONTINUE_SERVER_URL) {
    return process.env.CONTINUE_SERVER_URL;
  }
  
  return (
    vscode.workspace.getConfiguration("continue").get<string>("serverUrl") ||
    "http://localhost:65432"
  );
}
