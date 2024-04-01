import {
  BrowserSerializedContinueConfig,
  ChatMessage,
  ContextItemWithId,
  ContextSubmenuItem,
  LLMFullCompletionOptions,
  MessageContent,
  PersistedSessionInfo,
  RangeInFile,
  SerializedContinueConfig,
  SessionInfo,
} from ".";
import { AutocompleteInput } from "./autocomplete/completionProvider";
import { IdeProtocol } from "./web/webviewProtocol";

export type ProtocolGeneratorType<T> = AsyncGenerator<{
  done?: boolean;
  content: T;
}>;

export type Protocol = {
  // New
  "update/modelChange": [string, void];
  // Special
  ping: [string, string];
  abort: [undefined, void];

  // History
  "history/list": [undefined, SessionInfo[]];
  "history/copy": [{ id: string; workspaceDirectory: string }, void];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, PersistedSessionInfo];
  "history/save": [PersistedSessionInfo, void];
  "devdata/log": [{ tableName: string; data: any }, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    { model: SerializedContinueConfig["models"][number] },
    void,
  ];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getBrowserSerialized": [
    undefined,
    Promise<BrowserSerializedContinueConfig>,
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/reload": [undefined, Promise<BrowserSerializedContinueConfig>];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    Promise<ContextItemWithId[]>,
  ];
  "context/loadSubmenuItems": [
    { title: string },
    Promise<ContextSubmenuItem[]>,
  ];
  "context/addDocs": [{ title: string; url: string }, void];
  "autocomplete/complete": [AutocompleteInput, Promise<string[]>];
  "autocomplete/cancel": [undefined, void];
  "autocomplete/accept": [{ completionId: string }, void];
  "command/run": [
    {
      input: string;
      history: ChatMessage[];
      modelTitle: string;
      slashCommandName: string;
      contextItems: ContextItemWithId[];
      params: any;
      historyIndex: number;
      selectedCode: RangeInFile[];
    },
    ProtocolGeneratorType<string>,
  ];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    string,
  ];
  "llm/streamComplete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    ProtocolGeneratorType<string>,
  ];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    ProtocolGeneratorType<MessageContent>,
  ];
};

export interface IdeSettings {
  remoteConfigServerUrl: string | undefined;
  remoteConfigSyncPeriod: number;
  userToken: string;
}

export type ReverseProtocol = IdeProtocol & {
  getIdeSettings: [undefined, IdeSettings];
};
