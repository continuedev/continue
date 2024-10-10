import type { RangeInFileWithContents } from "../commands/util.js";
import type { ContextSubmenuItem } from "../index.js";
import { ToIdeFromWebviewOrCoreProtocol } from "./ide.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

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
  applyToCurrentFile: [{ text: string; streamId: string }, void];
  showTutorial: [undefined, void];
  showFile: [{ filepath: string }, void];
  openConfigJson: [undefined, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [{ newWindow?: boolean } | undefined, void];
  insertAtCursor: [{ text: string }, void];
  copyText: [{ text: string }, void];
  "jetbrains/editorInsetHeight": [{ height: number }, void];
  "vscode/openMoveRightMarkdown": [undefined, void];
  setGitHubAuthToken: [{ token: string }, void];
  acceptDiff: [{ filepath: string }, void];
  rejectDiff: [{ filepath: string }, void];
};

export interface ApplyState {
  streamId: string;
  status: "streaming" | "done" | "closed";
}

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
  setTTSActive: [boolean, void];
  submitMessage: [{ message: any }, void]; // any -> JSONContent from TipTap
  updateSubmenuItems: [
    { provider: string; submenuItems: ContextSubmenuItem[] },
    void,
  ];
  newSessionWithPrompt: [{ prompt: string }, void];
  userInput: [{ input: string }, void];
  focusContinueInput: [undefined, void];
  focusContinueInputWithoutClear: [undefined, void];
  focusContinueInputWithNewSession: [undefined, void];
  highlightedCode: [
    {
      rangeInFileWithContents: RangeInFileWithContents;
      prompt?: string;
      shouldRun?: boolean;
    },
    void,
  ];
  navigateTo: [{ path: string; toggle?: boolean }, void];
  addModel: [undefined, void];

  openSettings: [undefined, void];
  /**
   * @deprecated Use navigateTo with a path instead.
   */
  viewHistory: [undefined, void];
  newSession: [undefined, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  "jetbrains/editorInsetRefresh": [undefined, void];
  addApiKey: [undefined, void];
  setupLocalConfig: [undefined, void];
  incrementFtc: [undefined, void];
  openOnboardingCard: [undefined, void];
  applyCodeFromChat: [undefined, void];
  updateApplyState: [ApplyState, void];
};
