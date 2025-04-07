import { ToIdeFromWebviewOrCoreProtocol } from "./ide";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview";

import type {
  ApplyState,
  CodeToEdit,
  EditStatus,
  MessageContent,
  RangeInFileWithContents,
} from "../";

export type ToIdeFromWebviewProtocol = ToIdeFromWebviewOrCoreProtocol & {
  openUrl: [string, void];
  // We pass the `curSelectedModel` because we currently cannot access the
  // default model title in the GUI from JB
  applyToFile: [
    {
      text: string;
      streamId: string;
      curSelectedModelTitle: string;
      filepath?: string;
      toolCallId?: string;
    },
    void,
  ];
  overwriteFile: [{ filepath: string; prevFileContent: string | null }, void];
  showTutorial: [undefined, void];
  showFile: [{ filepath: string }, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [{ newWindow?: boolean } | undefined, void];
  insertAtCursor: [{ text: string }, void];
  copyText: [{ text: string }, void];
  "jetbrains/isOSREnabled": [undefined, boolean];
  "jetbrains/onLoad": [
    undefined,
    {
      windowId: string;
      serverUrl: string;
      workspacePaths: string[];
      vscMachineId: string;
      vscMediaUrl: string;
    },
  ];
  "jetbrains/getColors": [undefined, Record<string, string>];
  "vscode/openMoveRightMarkdown": [undefined, void];
  setGitHubAuthToken: [{ token: string }, void];
  acceptDiff: [{ filepath: string; streamId?: string }, void];
  rejectDiff: [{ filepath: string; streamId?: string }, void];
  "edit/sendPrompt": [
    {
      prompt: MessageContent;
      range: RangeInFileWithContents;
      selectedModelTitle: string;
    },
    void,
  ];
  "edit/exit": [{ shouldFocusEditor: boolean }, void];
};

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
  submitMessage: [{ message: any }, void]; // any -> JSONContent from TipTap
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
  addCodeToEdit: [CodeToEdit, void];
  navigateTo: [{ path: string; toggle?: boolean }, void];
  addModel: [undefined, void];

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
  setEditStatus: [{ status: EditStatus; fileAfterEdit?: string }, void];
  exitEditMode: [undefined, void];
  focusEdit: [undefined, void];
  focusEditWithoutClear: [undefined, void];
};
