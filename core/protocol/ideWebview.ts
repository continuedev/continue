import { ToIdeFromWebviewOrCoreProtocol } from "./ide.js";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview.js";

import type { RangeInFileWithContents } from "../commands/util.js";
import type { ContextSubmenuItem, MessageContent } from "../index.js";

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
  // We pass the `curSelectedModel` because we currently cannot access the
  // default model title in the GUI from JB
  applyToFile: [
    {
      text: string;
      streamId: string;
      curSelectedModelTitle: string;
      filepath?: string;
    },
    void,
  ];
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
  "jetbrains/isOSREnabled": [undefined, void];
  "vscode/openMoveRightMarkdown": [undefined, void];
  setGitHubAuthToken: [{ token: string }, void];
  acceptDiff: [{ filepath: string }, void];
  rejectDiff: [{ filepath: string }, void];
  "edit/sendPrompt": [
    { prompt: MessageContent; range: RangeInFileWithContents },
    void,
  ];
  "edit/acceptReject": [
    { accept: boolean; onlyFirst: boolean; filepath: string },
    void,
  ];
  "edit/escape": [undefined, void];
};

export interface EditModeArgs {
  highlightedCode: RangeInFileWithContents;
}

export type EditStatus =
  | "not-started"
  | "streaming"
  | "accepting"
  | "accepting:full-diff"
  | "done";

export interface ApplyState {
  streamId: string;
  status?: "streaming" | "done" | "closed";
  numDiffs?: number;
  filepath?: string;
}

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
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
  focusContinueSessionId: [{ sessionId: string | undefined }, void];
  newSession: [undefined, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  "jetbrains/editorInsetRefresh": [undefined, void];
  "jetbrains/isOSREnabled": [boolean, void];
  addApiKey: [undefined, void];
  setupLocalConfig: [undefined, void];
  incrementFtc: [undefined, void];
  openOnboardingCard: [undefined, void];
  applyCodeFromChat: [undefined, void];
  updateApplyState: [ApplyState, void];
  startEditMode: [EditModeArgs, void];
  setEditStatus: [{ status: EditStatus; fileAfterEdit?: string }, void];
  exitEditMode: [undefined, void];
};
