import { EXTENSION_NAME } from "core/control-plane/env";
import * as vscode from "vscode";

export async function getUserToken(): Promise<string> {
  // Prefer manual user token first
  const settings = vscode.workspace.getConfiguration(EXTENSION_NAME);
  const userToken = settings.get<string | null>("userToken", null);
  if (userToken) {
    return userToken;
  }

  const session = await vscode.authentication.getSession("github", [], {
    createIfNone: true,
  });
  return session.accessToken;
}
