import * as vscode from "vscode";
import { getUserToken } from "./auth";
import { RemoteConfigSync } from "./remoteConfig";

export async function setupRemoteConfigSync(reloadConfig: () => void) {
  const settings = vscode.workspace.getConfiguration("continue");
  const remoteConfigServerUrl = settings.get<string | null>(
    "remoteConfigServerUrl",
    null,
  );
  if (
    remoteConfigServerUrl === null ||
    remoteConfigServerUrl === undefined ||
    remoteConfigServerUrl.trim() === ""
  ) {
    return;
  }
  getUserToken().then(async (token) => {
    await vscode.workspace
      .getConfiguration("continue")
      .update("userToken", token, vscode.ConfigurationTarget.Global);
    try {
      const configSync = new RemoteConfigSync(reloadConfig, token);
      configSync.setup();
    } catch (e) {
      console.warn(`Failed to sync remote config: ${e}`);
    }
  });
}
