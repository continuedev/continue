import {
  ContextItemWithId,
  ContextSubmenuItem,
  ContinueRcJson,
  DiffLine,
  IndexTag,
  Problem,
  Range,
  Thread,
} from "..";
import { RangeInFileWithContents } from "../commands/util";

import { Protocol } from "../protocol";

export type IdeProtocol = {
  listWorkspaceContents: [undefined, string[]];
  getWorkspaceDirs: [undefined, string[]];
  listFolders: [undefined, string[]];
  writeFile: [{ path: string; contents: string }, void];
  showVirtualFile: [{ name: string; content: string }, void];
  getContinueDir: [undefined, string];
  openFile: [{ path: string }, void];
  runCommand: [{ command: string }, void];
  getSearchResults: [{ query: string }, string];
  subprocess: [{ command: string }, [string, string]];
  saveFile: [{ filepath: string }, void];
  readFile: [{ filepath: string }, string];
  showDiff: [
    { filepath: string; newContents: string; stepIndex: number },
    void,
  ];
  diffLine: [
    {
      diffLine: DiffLine;
      filepath: string;
      startLine: number;
      endLine: number;
    },
    void,
  ];
  getProblems: [{ filepath: string }, Problem[]];
  getBranch: [{ dir: string }, string];
  getOpenFiles: [undefined, string[]];
  getPinnedFiles: [undefined, string[]];
  showLines: [{ filepath: string; startLine: number; endLine: number }, void];
  readRangeInFile: [{ filepath: string; range: Range }, string];
  getDiff: [undefined, string];
  getWorkspaceConfigs: [undefined, ContinueRcJson[]];
  getTerminalContents: [undefined, string];
  getDebugLocals: [{ threadIndex: Number }, string];
  getTopLevelCallStackSources: [
    { threadIndex: number; stackDepth: number },
    string[],
  ];
  getAvailableThreads: [undefined, Thread[]];
  isTelemetryEnabled: [undefined, boolean];
  getUniqueId: [undefined, string];
  getTags: [string, IndexTag[]];
};

export type WebviewProtocol = Protocol &
  IdeProtocol & {
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

    errorPopup: [{ message: string }, void];
    "index/setPaused": [boolean, void];
    "index/forceReIndex": [undefined, void];
    openUrl: [string, void];
    applyToCurrentFile: [{ text: string }, void];
    showTutorial: [undefined, void];
    showFile: [{ filepath: string }, void];
    openConfigJson: [undefined, void];

    toggleDevTools: [undefined, void];
    reloadWindow: [undefined, void];
    focusEditor: [undefined, void];
    toggleFullScreen: [undefined, void];
    "stats/getTokensPerDay": [undefined, { day: string; tokens: number }[]];
    "stats/getTokensPerModel": [undefined, { model: string; tokens: number }[]];
    insertAtCursor: [{ text: string }, void];
    copyText: [{ text: string }, void];
    "jetbrains/editorInsetHeight": [{ height: number }, void];
    completeOnboarding: [
      {
        mode:
          | "local"
          | "optimized"
          | "custom"
          | "localExistingUser"
          | "optimizedExistingUser";
      },
      void,
    ];
  };

export type ReverseWebviewProtocol = {
  setInactive: [undefined, void];
  configUpdate: [undefined, void];
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
  getDefaultModelTitle: [undefined, string];
  newSessionWithPrompt: [{ prompt: string }, void];
  userInput: [{ input: string }, void];
  focusContinueInput: [undefined, void];
  focusContinueInputWithoutClear: [undefined, void];
  focusContinueInputWithNewSession: [undefined, void];
  highlightedCode: [{ rangeInFileWithContents: RangeInFileWithContents }, void];
  addModel: [undefined, void];
  openSettings: [undefined, void];
  viewHistory: [undefined, void];
  indexProgress: [{ progress: number; desc: string }, void];
  newSession: [undefined, void];
  refreshSubmenuItems: [undefined, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  "jetbrains/editorInsetRefresh": [undefined, void];
};
