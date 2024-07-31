/* eslint-disable @typescript-eslint/naming-convention */
import type { AutocompleteInput } from "../autocomplete/completionProvider.js";
import { ProfileDescription } from "../config/ConfigHandler.js";
import type {
  BrowserSerializedContinueConfig,
  ChatMessage,
  ContextItemWithId,
  ContextSubmenuItem,
  DiffLine,
  IdeSettings,
  LLMFullCompletionOptions,
  MessageContent,
  ModelDescription,
  PersistedSessionInfo,
  RangeInFile,
  SerializedContinueConfig,
  SessionInfo,
  SiteIndexingConfig,
} from "../index.js";

export type ProtocolGeneratorType<T> = AsyncGenerator<{
  done?: boolean;
  content: T;
}>;

export interface ListHistoryOptions {
  offset?: number;
  limit?: number;
}

export type ToCoreFromIdeOrWebviewProtocol = {
  "update/modelChange": [string, void];
  "update/selectTabAutocompleteModel": [string, void];

  // Special
  ping: [string, string];
  abort: [undefined, void];

  // History
  "history/list": [ListHistoryOptions, SessionInfo[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, PersistedSessionInfo];
  "history/save": [PersistedSessionInfo, void];
  "devdata/log": [{ tableName: string; data: any }, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    { model: SerializedContinueConfig["models"][number] },
    void,
  ];
  "config/newPromptFile": [undefined, void];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getSerializedProfileInfo": [
    undefined,
    { config: BrowserSerializedContinueConfig; profileId: string },
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/reload": [undefined, BrowserSerializedContinueConfig];
  "config/listProfiles": [undefined, ProfileDescription[]];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    ContextItemWithId[],
  ];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "autocomplete/complete": [AutocompleteInput, string[]];
  "context/addDocs": [SiteIndexingConfig, void];
  "context/removeDocs": [Pick<SiteIndexingConfig, "startUrl">, void];
  "context/indexDocs": [{ reIndex: boolean }, void];
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
  "llm/listModels": [{ title: string }, string[] | undefined];
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
    { day: string; promptTokens: number; generatedTokens: number }[],
  ];
  "stats/getTokensPerModel": [
    undefined,
    { model: string; promptTokens: number; generatedTokens: number }[],
  ];
  "index/setPaused": [boolean, void];
  "index/forceReIndex": [undefined | string, void];
  "index/indexingProgressBarInitialized": [undefined, void];
  completeOnboarding: [
    {
      mode:
        | "local"
        | "apiKeys"
        | "custom"
        | "freeTrial"
        | "localAfterFreeTrial"
        | "bestExperience";
    },
    void,
  ];
  addAutocompleteModel: [{ model: ModelDescription }, void];

  "profiles/switch": [{ id: string }, undefined];

  "auth/getAuthUrl": [undefined, { url: string }];
};
