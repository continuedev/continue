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

  constructor(private triggerReloadConfig: () => void) {
    const { userToken, remoteConfigServerUrl, remoteConfigSyncPeriod } =
      this.loadVsCodeSettings();
    this.userToken = userToken;
    this.remoteConfigServerUrl = remoteConfigServerUrl;
    this.remoteConfigSyncPeriod = remoteConfigSyncPeriod;

    // Listen for changes to VS Code settings, then trigger a refresh
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("continue")) {
        const { userToken, remoteConfigServerUrl, remoteConfigSyncPeriod } =
          this.loadVsCodeSettings();
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
    await this.sync(this.userToken, new URL(this.remoteConfigServerUrl));

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
        this.sync(this.userToken, new URL(this.remoteConfigServerUrl));
      },
      this.remoteConfigSyncPeriod * 1000 * 60,
    );
  }

  async sync(userToken: string, remoteConfigServerUrl: URL) {
    try {
      const response = await fetch(
        new URL("sync", remoteConfigServerUrl).href,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        },
      );

      if (!response.ok) {
        vscode.window.showErrorMessage(
          `Failed to sync remote config (HTTP ${response.status}): ${response.statusText}`,
        );
        return;
      }

      const { configJson, configJs } = await response.json();

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
      vscode.window.showErrorMessage(`Failed to sync remote config: ${e}`);
    }
  }
}
