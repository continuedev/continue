import type { ContextItemWithId, ContextSubmenuItem } from "..";
import type { RangeInFileWithContents } from "../commands/util";
import { ToIdeFromWebviewOrCoreProtocol } from "./ide";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview";

export interface IdeSettings {
  remoteConfigServerUrl: string | undefined;
  remoteConfigSyncPeriod: number;
  userToken: string;
}

export type ToIdeFromWebviewProtocol = ToIdeFromWebviewOrCoreProtocol & {
  onLoad: [
    undefined,
    {
      windowId: string;
      serverUrl: string;
      workspacePaths: string[];
      vscMachineId: string;
      vscMediaUrl: string;
    },
  ];
  openUrl: [string, void];
  applyToCurrentFile: [{ text: string }, void];
  showTutorial: [undefined, void];
  showFile: [{ filepath: string }, void];
  openConfigJson: [undefined, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [undefined, void];
  insertAtCursor: [{ text: string }, void];
  copyText: [{ text: string }, void];
  "jetbrains/editorInsetHeight": [{ height: number }, void];
  setGitHubAuthToken: [{ token: string }, void];
};

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
  submitMessage: [{ message: any }, void]; // any -> JSONContent from TipTap
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
  updateSubmenuItems: [
    { provider: string; submenuItems: ContextSubmenuItem[] },
    void,
  ];
  newSessionWithPrompt: [{ prompt: string }, void];
  userInput: [{ input: string }, void];
  focusContinueInput: [undefined, void];
  focusContinueInputWithoutClear: [undefined, void];
  focusContinueInputWithNewSession: [undefined, void];
  highlightedCode: [{ rangeInFileWithContents: RangeInFileWithContents }, void];
  addModel: [undefined, void];
  openSettings: [undefined, void];
  viewHistory: [undefined, void];
  newSession: [undefined, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  "jetbrains/editorInsetRefresh": [undefined, void];
  addApiKey: [undefined, void];
  setupLocalModel: [undefined, void];
  incrementFtc: [undefined, void];
  openOnboarding: [undefined, void];
};
