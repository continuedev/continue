import type {
  ContinueRcJson,
  DiffLine,
  FileType,
  IdeInfo,
  IdeSettings,
  IndexTag,
  Location,
  Problem,
  Range,
  RangeInFile,
  Thread,
} from "..";
import { ControlPlaneSessionInfo } from "../control-plane/client";

export type ToIdeFromWebviewOrCoreProtocol = {
  // Methods from IDE type
  getIdeInfo: [undefined, IdeInfo];
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
  fileExists: [{ filepath: string }, boolean];
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
  getOpenFiles: [undefined, string[]];
  getCurrentFile: [undefined, string | undefined];
  getPinnedFiles: [undefined, string[]];
  showLines: [{ filepath: string; startLine: number; endLine: number }, void];
  readRangeInFile: [{ filepath: string; range: Range }, string];
  getDiff: [undefined, string];
  getWorkspaceConfigs: [undefined, ContinueRcJson[]];
  getTerminalContents: [undefined, string];
  getDebugLocals: [{ threadIndex: number }, string];
  getTopLevelCallStackSources: [
    { threadIndex: number; stackDepth: number },
    string[],
  ];
  getAvailableThreads: [undefined, Thread[]];
  isTelemetryEnabled: [undefined, boolean];
  getUniqueId: [undefined, string];
  getTags: [string, IndexTag[]];
  // end methods from IDE type

  getIdeSettings: [undefined, IdeSettings];

  // Git
  getBranch: [{ dir: string }, string];
  getRepoName: [{ dir: string }, string | undefined];

  errorPopup: [{ message: string }, void];
  infoPopup: [{ message: string }, void];
  getGitRootPath: [{ dir: string }, string | undefined];
  listDir: [{ dir: string }, [string, FileType][]];
  getLastModified: [{ files: string[] }, { [path: string]: number }];

  gotoDefinition: [{ location: Location }, RangeInFile[]];

  getGitHubAuthToken: [undefined, string | undefined];
  getControlPlaneSessionInfo: [
    { silent: boolean },
    ControlPlaneSessionInfo | undefined,
  ];
  pathSep: [undefined, string];
};

export type ToWebviewOrCoreFromIdeProtocol = {
  didChangeActiveTextEditor: [{ filepath: string }, void];
  didChangeControlPlaneSessionInfo: [
    { sessionInfo: ControlPlaneSessionInfo | undefined },
    void,
  ];
};
