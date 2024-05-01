import type {
  BrowserSerializedContinueConfig,
  ChatMessage,
  ContextItemWithId,
  ContextSubmenuItem,
  DiffLine,
  LLMFullCompletionOptions,
  MessageContent,
  PersistedSessionInfo,
  RangeInFile,
  SerializedContinueConfig,
  SessionInfo,
} from "..";
import type { AutocompleteInput } from "../autocomplete/completionProvider";
import type { IdeSettings } from "./ideWebview";

export type ProtocolGeneratorType<T> = AsyncGenerator<{
  done?: boolean;
  content: T;
}>;

export type ToCoreFromIdeOrWebviewProtocol = {
  // New
  "update/modelChange": [string, void];

  // Special
  ping: [string, string];
  abort: [undefined, void];

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
    Promise<string>,
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
  streamDiffLines: [
    {
      prefix: string;
      highlighted: string;
      suffix: string;
      input: string;
      language: string | undefined;
      modelTitle: string | undefined;
    },
    ProtocolGeneratorType<DiffLine>,
  ];
  "stats/getTokensPerDay": [
    undefined,
    Promise<{ day: string; tokens: number }[]>,
  ];
  "stats/getTokensPerModel": [
    undefined,
    Promise<{ model: string; tokens: number }[]>,
  ];
  "index/setPaused": [boolean, void];
  "index/forceReIndex": [undefined, void];
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
