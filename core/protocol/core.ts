import {
  BlockType,
  ConfigResult,
  DevDataLogEvent,
  ModelRole,
} from "@continuedev/config-yaml";

import {
  AutocompleteInput,
  RecentlyEditedRange,
} from "../autocomplete/util/types";
import { SharedConfigSchema } from "../config/sharedConfig";
import { GlobalContextModelSelections } from "../util/GlobalContext";

import {
  BrowserSerializedContinueConfig,
  ChatMessage,
  CompleteOnboardingPayload,
  ContextItem,
  ContextItemWithId,
  ContextSubmenuItem,
  DiffLine,
  DocsIndexingDetails,
  ExperimentalModelRoles,
  FileSymbolMap,
  IdeSettings,
  LLMFullCompletionOptions,
  ModelDescription,
  PromptLog,
  RangeInFile,
  RangeInFileWithNextEditInfo,
  SerializedContinueConfig,
  Session,
  SessionMetadata,
  SiteIndexingConfig,
  SlashCommandDescWithSource,
  StreamDiffLinesPayload,
  ToolCall,
} from "../";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../autocomplete/types";
import { ConfigHandler } from "../config/ConfigHandler";
import { SerializedOrgWithProfiles } from "../config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "../control-plane/AuthTypes";
import { FreeTrialStatus } from "../control-plane/client";

export enum OnboardingModes {
  API_KEY = "API Key",
  LOCAL = "Local",
  MODELS_ADD_ON = "Models Add-On",
}

export interface ListHistoryOptions {
  offset?: number;
  limit?: number;
}

export type ToCoreFromIdeOrWebviewProtocol = {
  // Special
  ping: [string, string];
  abort: [undefined, void];
  cancelApply: [undefined, void];

  // History
  "history/list": [ListHistoryOptions, SessionMetadata[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, Session];
  "history/save": [Session, void];
  "history/clear": [undefined, void];
  "devdata/log": [DevDataLogEvent, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    {
      model: SerializedContinueConfig["models"][number];
      role?: keyof ExperimentalModelRoles;
    },
    void,
  ];
  "config/addLocalWorkspaceBlock": [{ blockType: BlockType }, void];
  "config/newPromptFile": [undefined, void];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getSerializedProfileInfo": [
    undefined,
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string | null;
      organizations: SerializedOrgWithProfiles[];
      selectedOrgId: string;
    },
  ];
  "config/deleteModel": [{ title: string }, void];
  "config/reload": [undefined, ConfigResult<BrowserSerializedContinueConfig>];
  "config/refreshProfiles": [
    (
      | undefined
      | {
          selectOrgId?: string;
          selectProfileId?: string;
        }
    ),
    void,
  ];
  "config/openProfile": [{ profileId: string | undefined }, void];
  "config/updateSharedConfig": [SharedConfigSchema, SharedConfigSchema];
  "config/updateSelectedModel": [
    {
      profileId: string;
      role: ModelRole;
      title: string | null;
    },
    GlobalContextModelSelections,
  ];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    ContextItemWithId[],
  ];
  "mcp/reloadServer": [
    {
      id: string;
    },
    void,
  ];
  "mcp/getPrompt": [
    {
      serverName: string;
      promptName: string;
      args?: Record<string, string>;
    },
    {
      prompt: string;
      description: string | undefined;
    },
  ];
  "context/getSymbolsForFiles": [{ uris: string[] }, FileSymbolMap];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "autocomplete/complete": [AutocompleteInput, string[]];
  "context/addDocs": [SiteIndexingConfig, void];
  "context/removeDocs": [Pick<SiteIndexingConfig, "startUrl">, void];
  "context/indexDocs": [{ reIndex: boolean }, void];
  "autocomplete/cancel": [undefined, void];
  "autocomplete/accept": [{ completionId: string }, void];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    string,
  ];
  "llm/listModels": [{ title: string }, string[] | undefined];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
      title: string;
      legacySlashCommandData?: {
        command: SlashCommandDescWithSource;
        input: string;
        contextItems: ContextItemWithId[];
        historyIndex: number;
        selectedCode: RangeInFile[];
      };
    },
    AsyncGenerator<ChatMessage, PromptLog>,
  ];
  streamDiffLines: [StreamDiffLinesPayload, AsyncGenerator<DiffLine>];
  "chatDescriber/describe": [
    {
      text: string;
    },
    string | undefined,
  ];
  "stats/getTokensPerDay": [
    undefined,
    { day: string; promptTokens: number; generatedTokens: number }[],
  ];
  "stats/getTokensPerModel": [
    undefined,
    { model: string; promptTokens: number; generatedTokens: number }[],
  ];
  "tts/kill": [undefined, void];

  // Codebase indexing
  "index/setPaused": [boolean, void];
  "index/forceReIndex": [
    undefined | { dirs?: string[]; shouldClearIndexes?: boolean },
    void,
  ];
  "index/indexingProgressBarInitialized": [undefined, void];
  "onboarding/complete": [CompleteOnboardingPayload, void];

  // File changes
  "files/changed": [{ uris?: string[] }, void];
  "files/opened": [{ uris?: string[] }, void];
  "files/created": [{ uris?: string[] }, void];
  "files/deleted": [{ uris?: string[] }, void];
  "files/closed": [{ uris?: string[] }, void];
  "files/smallEdit": [
    {
      actions: RangeInFileWithNextEditInfo[];
      configHandler: ConfigHandler;
      getDefsFromLspFunction: GetLspDefinitionsFunction;
      recentlyEditedRanges: RecentlyEditedRange[];
      recentlyVisitedRanges: AutocompleteCodeSnippet[];
    },
    void,
  ];

  // Docs etc. Indexing. TODO move codebase to this
  "indexing/reindex": [{ type: string; id: string }, void];
  "indexing/abort": [{ type: string; id: string }, void];
  "indexing/setPaused": [{ type: string; id: string; paused: boolean }, void];
  "docs/getSuggestedDocs": [undefined, void];
  "docs/initStatuses": [undefined, void];
  "docs/getDetails": [{ startUrl: string }, DocsIndexingDetails];
  addAutocompleteModel: [{ model: ModelDescription }, void];

  "auth/getAuthUrl": [{ useOnboarding: boolean }, { url: string }];
  "tools/call": [
    { toolCall: ToolCall },
    { contextItems: ContextItem[]; errorMessage?: string },
  ];
  "clipboardCache/add": [{ content: string }, void];
  "controlPlane/openUrl": [{ path: string; orgSlug?: string }, void];
  "controlPlane/getFreeTrialStatus": [undefined, FreeTrialStatus | null];
  "controlPlane/getModelsAddOnUpgradeUrl": [
    { vsCodeUriScheme?: string },
    { url: string } | null,
  ];
  isItemTooBig: [{ item: ContextItemWithId }, boolean];
  didChangeControlPlaneSessionInfo: [
    { sessionInfo: ControlPlaneSessionInfo | undefined },
    void,
  ];
  "process/markAsBackgrounded": [{ toolCallId: string }, void];
  "process/isBackgrounded": [{ toolCallId: string }, boolean];
  "mdm/setLicenseKey": [{ licenseKey: string }, boolean];
};
