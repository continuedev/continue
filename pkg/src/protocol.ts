import { BrowserSerializedContinueConfig } from "core/config/load";
import {
  ChatMessage,
  CompletionOptions,
  ContextItem,
  ContextSubmenuItem,
  PersistedSessionInfo,
  RangeInFile,
  SerializedContinueConfig,
  SessionInfo,
} from "../../core";

export type Protocol = {
  // New
  "update/modelChange": [string, void];
  // Special
  ping: [string, string];
  abort: [undefined, void];

  // History
  "history/list": [undefined, SessionInfo[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, PersistedSessionInfo];
  "history/save": [PersistedSessionInfo, void];
  "devdata/log": [{ tableName: string; data: any }, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    { model: SerializedContinueConfig["models"][number] },
    void,
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/reload": [undefined, void];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    Promise<ContextItem[]>,
  ];
  "context/loadSubmenuItems": [
    { title: string },
    Promise<ContextSubmenuItem[]>,
  ];
  "context/addDocs": [{ title: string; url: string }, void];
  "autocomplete/complete": [
    { filepath: string; line: number; column: number },
    string[],
  ];
  "command/run": [
    {
      input: string;
      history: ChatMessage[];
      modelTitle: string;
      slashCommandName: string;
      contextItems: ContextItem[];
      params: any;
      historyIndex: number;
    },
    AsyncGenerator<string>,
  ];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
  "llm/streamComplete": [
    {
      prompt: string;
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];

  // Pass-through from webview
  getSerializedConfig: [undefined, Promise<BrowserSerializedContinueConfig>];
};
