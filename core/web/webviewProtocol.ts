import {
  ContextItemWithId,
  ContinueRcJson,
  DiffLine,
  Problem,
  Range,
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
  isTelemetryEnabled: [undefined, boolean];
  getUniqueId: [undefined, string];
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
    openUrl: [string, void];
    applyToCurrentFile: [{ text: string }, void];
    showTutorial: [undefined, void];
    showFile: [{ filepath: string }, void];
    openConfigJson: [undefined, void];

    toggleDevTools: [undefined, void];
    reloadWindow: [undefined, void];
    focusEditor: [undefined, void];
    toggleFullScreen: [undefined, void];
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
};
