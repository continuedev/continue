import {
  ChatMessage,
  CompletionOptions,
  ContextItem,
  ContextItemWithId,
  ContextSubmenuItem,
  DiffLine,
  MessageContent,
  ModelDescription,
  PersistedSessionInfo,
  Problem,
  RangeInFile,
} from "..";
import { BrowserSerializedContinueConfig } from "../config/load";

export type WebviewProtocol = {
  abort: [undefined, void];
  listWorkspaceContents: [undefined, Promise<string[]>];
  getWorkspaceDirs: [undefined, Promise<string[]>];
  listFolders: [undefined, Promise<string[]>];
  writeFile: [{ path: string; contents: string }, void];
  showVirtualFile: [{ name: string; content: string }, void];
  getContinueDir: [undefined, Promise<string>];
  openFile: [{ path: string }, void];
  runCommand: [{ command: string }, void];
  getSearchResults: [{ query: string }, Promise<string>];
  subprocess: [{ command: string }, Promise<[string, string]>];
  history: [undefined, PersistedSessionInfo[]];
  saveSession: [PersistedSessionInfo, void];
  deleteSession: [string, void];
  loadSession: [string, PersistedSessionInfo];
  saveFile: [{ filepath: string }, void];
  readFile: [{ filepath: string }, Promise<string>];
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
  getProblems: [{ filepath: string }, Promise<Problem[]>];
  getBranch: [{ dir: string }, Promise<string>];
  getOpenFiles: [undefined, Promise<string[]>];
  getPinnedFiles: [undefined, Promise<string[]>];
  showLines: [{ filepath: string; startLine: number; endLine: number }, void];
  errorPopup: [{ message: string }, void];
  logDevData: [{ tableName: string; data: any }, void];
  addModel: [ModelDescription, void];
  deleteModel: [{ title: string }, void];
  addOpenAIKey: [{ key: string }, void];
  llmStreamComplete: [
    { title: string; prompt: string; completionOptions: CompletionOptions },
    AsyncGenerator<{ content: string; done?: boolean }>,
  ];
  llmStreamChat: [
    {
      title: string;
      messages: ChatMessage[];
      completionOptions: CompletionOptions;
    },
    AsyncGenerator<{ content: MessageContent; done?: boolean }>,
  ];
  llmComplete: [
    { title: string; prompt: string; completionOptions: CompletionOptions },
    Promise<{ content: string }>,
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
  loadSubmenuItems: [{ title: string }, Promise<ContextSubmenuItem[]>];
  getContextItems: [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    Promise<ContextItem[]>,
  ];
  addDocs: [{ url: string; title: string }, void];
  applyToCurrentFile: [{ text: string }, void];
  showTutorial: [undefined, void];
  showFile: [{ filepath: string }, void];
  openConfigJson: [undefined, void];
  readRangeInFile: [{ filepath: string }, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [undefined, void];
  getDiff: [undefined, Promise<string>];
  getSerializedConfig: [undefined, Promise<BrowserSerializedContinueConfig>];
  getTerminalContents: [undefined, Promise<string>];
};
