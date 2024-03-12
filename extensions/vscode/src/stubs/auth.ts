import * as vscode from "vscode";

export async function getUserToken(): Promise<string> {
  const session = await vscode.authentication.getSession("github", [], {
    createIfNone: true,
  });
  return session.accessToken;
}
