import {
  getConfigJsPathForRemote,
  getConfigJsonPathForRemote,
  getPathToRemoteConfig,
} from "core/util/paths";
import * as fs from "fs";
import * as vscode from "vscode";
import { configHandler } from "../loadConfig";

export async function setupRemoteConfigSync() {
  const settings = vscode.workspace.getConfiguration("continue");
  const userToken = settings.get<string | null>("userToken", null);
  const remoteConfigServerUrl = settings.get<string | null>(
    "remoteConfigServerUrl",
    null
  );
  const remoteConfigSyncPeriod = settings.get<number>(
    "remoteConfigSyncPeriod",
    60
  );

  if (
    userToken === null ||
    remoteConfigServerUrl === null ||
    remoteConfigServerUrl.trim() === ""
  ) {
    return;
  }
  if (!URL.canParse(remoteConfigServerUrl)) {
    vscode.window.showErrorMessage(
      "The value set for 'remoteConfigServerUrl' is not valid: ",
      remoteConfigServerUrl
    );
    return;
  }

  // Sync once and then set timer
  await syncRemoteConfig(userToken, new URL(remoteConfigServerUrl));
  setInterval(() => {
    syncRemoteConfig(userToken, new URL(remoteConfigServerUrl));
  }, remoteConfigSyncPeriod * 1000);
}

async function syncRemoteConfig(userToken: string, remoteConfigServerUrl: URL) {
  const response = await fetch(new URL("sync", remoteConfigServerUrl).href, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  const remoteConfigDirectory = getPathToRemoteConfig(remoteConfigServerUrl);

  const { configJson, configJs } = await response.json();
  fs.writeFileSync(
    getConfigJsonPathForRemote(remoteConfigServerUrl),
    configJson
  );
  fs.writeFileSync(getConfigJsPathForRemote(remoteConfigServerUrl), configJs);
  configHandler.reloadConfig();
}
