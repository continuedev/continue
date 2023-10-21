import * as vscode from "vscode";

function _getRawServerUrl() {
  // Passed in from launch.json
  if (process.env.CONTINUE_SERVER_URL) {
    return process.env.CONTINUE_SERVER_URL;
  }

  return (
    vscode.workspace.getConfiguration("continue").get<string>("serverUrl") ||
    "http://localhost:65432"
  );
}

export function getContinueServerUrl() {
  let url = _getRawServerUrl();
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}
