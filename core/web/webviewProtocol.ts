import {
  ChatMessage,
  ContextItemWithId,
  ContextSubmenuItem,
  ContinueRcJson,
  DiffLine,
  LLMFullCompletionOptions,
  MessageContent,
  ModelDescription,
  PersistedSessionInfo,
  Problem,
  Range,
  RangeInFile,
  SessionInfo,
} from "..";
import { RangeInFileWithContents } from "../commands/util";
import { BrowserSerializedContinueConfig } from "../config/load";

export type WebviewProtocol = {
  abort: [string, void];
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
  history: [undefined, SessionInfo[]];
  saveSession: [PersistedSessionInfo, void];
  deleteSession: [string, void];
  loadSession: [string, PersistedSessionInfo];
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
  errorPopup: [{ message: string }, void];
  logDevData: [{ tableName: string; data: any }, void];
  addModel: [ModelDescription, void];
  deleteModel: [{ title: string }, void];
  addOpenAIKey: [{ key: string }, void];
  llmStreamComplete: [
    {
      title: string;
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
    },
    AsyncGenerator<{ content: string; done?: boolean }>,
  ];
  llmStreamChat: [
    {
      title: string;
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
    },
    AsyncGenerator<{ content: MessageContent; done?: boolean }>,
  ];
  llmComplete: [
    {
      title: string;
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
    },
    { content: string },
  ];
  runNodeJsSlashCommand: [
    {
      input: string;
      history: ChatMessage[];
      modelTitle: string;
      slashCommandName: string;
      contextItems: ContextItemWithId[];
      params: { [key: string]: any } | undefined;
      historyIndex: number;
    },
    AsyncGenerator<{ content: string; done?: boolean }>,
  ];
  loadSubmenuItems: [{ title: string }, ContextSubmenuItem[]];
  getContextItems: [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    ContextItemWithId[],
  ];
  addDocs: [{ url: string; title: string }, void];
  applyToCurrentFile: [{ text: string }, void];
  showTutorial: [undefined, void];
  showFile: [{ filepath: string }, void];
  openConfigJson: [undefined, void];
  readRangeInFile: [{ filepath: string; range: Range }, string];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [undefined, void];
  getDiff: [undefined, string];
  getSerializedConfig: [undefined, BrowserSerializedContinueConfig];
  getTerminalContents: [undefined, string];
  isTelemetryEnabled: [undefined, boolean];
  getUniqueId: [undefined, string];
  getWorkspaceConfigs: [undefined, ContinueRcJson[]];
  getDefaultModelTitle: [{ defaultModelTitle: string }, void];
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
