import { ContinueServerClient } from "core/continueServer/stubs/client";
import {
  getConfigJsPathForRemote,
  getConfigJsonPathForRemote,
} from "core/util/paths";
import * as fs from "fs";
import * as vscode from "vscode";

export class RemoteConfigSync {
  private userToken: string | null;
  private remoteConfigServerUrl: string | null;
  private remoteConfigSyncPeriod: number;

  private syncInterval: NodeJS.Timer | undefined = undefined;

  constructor(
    private triggerReloadConfig: () => void,
    userToken: string | null,
  ) {
    let {
      userToken: settingsUserToken,
      remoteConfigServerUrl,
      remoteConfigSyncPeriod,
    } = this.loadVsCodeSettings();
    this.userToken = settingsUserToken || userToken;
    this.remoteConfigServerUrl = remoteConfigServerUrl;
    this.remoteConfigSyncPeriod = remoteConfigSyncPeriod;

    // Listen for changes to VS Code settings, then trigger a refresh
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("continue")) {
        const { userToken, remoteConfigServerUrl, remoteConfigSyncPeriod } =
          await this.loadVsCodeSettings();
        if (
          userToken !== this.userToken ||
          remoteConfigServerUrl !== this.remoteConfigServerUrl ||
          remoteConfigSyncPeriod !== this.remoteConfigSyncPeriod
        ) {
          this.userToken = userToken;
          this.remoteConfigServerUrl = remoteConfigServerUrl;
          this.remoteConfigSyncPeriod = remoteConfigSyncPeriod;

          this.setInterval();
        }
      }
    });
  }

  private loadVsCodeSettings() {
    const settings = vscode.workspace.getConfiguration("continue");
    const userToken = settings.get<string | null>("userToken", null);
    const remoteConfigServerUrl = settings.get<string | null>(
      "remoteConfigServerUrl",
      null,
    );
    const remoteConfigSyncPeriod = settings.get<number>(
      "remoteConfigSyncPeriod",
      60,
    );

    return {
      userToken,
      remoteConfigServerUrl,
      remoteConfigSyncPeriod,
    };
  }

  async setup() {
    if (
      this.userToken === null ||
      this.remoteConfigServerUrl === null ||
      this.remoteConfigServerUrl.trim() === ""
    ) {
      return;
    }
    if (!URL.canParse(this.remoteConfigServerUrl)) {
      vscode.window.showErrorMessage(
        "The value set for 'remoteConfigServerUrl' is not valid: ",
        this.remoteConfigServerUrl,
      );
      return;
    }

    // Sync once
    await this.sync(this.userToken, this.remoteConfigServerUrl);

    // Set timer to sync at user-defined interval
    this.setInterval();
  }

  private setInterval() {
    if (this.syncInterval !== undefined) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(
      () => {
        if (!this.userToken || !this.remoteConfigServerUrl) return;
        this.sync(this.userToken, this.remoteConfigServerUrl);
      },
      this.remoteConfigSyncPeriod * 1000 * 60,
    );
  }

  async sync(userToken: string, remoteConfigServerUrl: string) {
    try {
      const client = new ContinueServerClient(
        remoteConfigServerUrl.toString(),
        userToken,
      );
      const { configJson, configJs } = await client.getConfig();

      fs.writeFileSync(
        getConfigJsonPathForRemote(remoteConfigServerUrl),
        configJson,
      );
      fs.writeFileSync(
        getConfigJsPathForRemote(remoteConfigServerUrl),
        configJs,
      );
      this.triggerReloadConfig();
    } catch (e) {
      vscode.window.showWarningMessage(`Failed to sync remote config: ${e}`);
    }
  }
}
