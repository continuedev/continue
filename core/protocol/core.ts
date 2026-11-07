import {
  BlockType,
  ConfigResult,
  DevDataLogEvent,
  ModelRole,
} from "@continuedev/config-yaml";
import { ToolPolicy } from "@continuedev/terminal-security";

import {
  AutocompleteInput,
  RecentlyEditedRange,
} from "../autocomplete/util/types";
import { ProfileDescription } from "../config/ProfileLifecycleManager";
import { SharedConfigSchema } from "../config/sharedConfig";
import type {
  MovePlaintextKeysResult,
  PlaintextKey,
  ProviderInstancesInfo,
  SaveProviderInstanceRequest,
  SaveProviderInstanceResult,
} from "../config/providers/types";
import type { ModeModelsInput } from "../config/yaml/saveModeModels";
import type { SubagentLoadResult } from "../subagents/loadSubagents";
import type { DetectedLocalServer } from "../llm/localServers";
import type { RulesByModeInput } from "../config/yaml/saveRulesByMode";
import type {
  AutoReviewReply,
  AutoReviewRequest,
} from "../tools/permissions/auto/handler";
import type {
  McpImportPreview,
  McpImportRequest,
  McpImportResult,
} from "../config/importClineMcp";
import type {
  ProviderSetupInfo,
  SaveProviderModelsRequest,
  SaveProviderModelsResult,
} from "../config/providerSetup";
import type { DecisionSource as ToolDecisionSource } from "../tools/permissions/decide";
import type { ApprovalSettings } from "../tools/permissions/approval";
import { GlobalContextModelSelections } from "../util/GlobalContext";

import {
  BaseSessionMetadata,
  BrowserSerializedContinueConfig,
  ChatMessage,
  CompiledMessagesResult,
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
  McpUiState,
  MessageOption,
  ModelDescription,
  PromptLog,
  RangeInFile,
  RangeInFileWithNextEditInfo,
  SerializedContinueConfig,
  Session,
  SiteIndexingConfig,
  SlashCommandDescWithSource,
  StreamDiffLinesPayload,
  ToolCall,
} from "../";
import { AutocompleteCodeSnippet } from "../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../autocomplete/types";
import { ConfigHandler } from "../config/ConfigHandler";
import { ProcessedItem } from "../nextEdit/NextEditPrefetchQueue";
import { NextEditOutcome } from "../nextEdit/types";
import { ContinueErrorReason } from "../util/errors";

export enum OnboardingModes {
  API_KEY = "API Key",
  LOCAL = "Local",
}

export interface ListHistoryOptions {
  offset?: number;
  limit?: number;
  workspaceDirectory?: string;
}

/** Connection settings the add-model form sends to try out Bedrock before saving. */
export interface BedrockConnectionParams {
  /** "mantle" targets the OpenAI-compatible bedrock-mantle endpoint; default is bedrock-runtime. */
  endpoint?: "mantle";
  mantlePathPrefix?: string;
  maxTokensParam?: string;
  region?: string;
  apiKey?: string;
  apiBase?: string;
  profile?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  crossRegionInference?: string;
  serviceTier?: string;
  latency?: string;
  guardrailIdentifier?: string;
  guardrailVersion?: string;
}

export interface BedrockModelOptionInfo {
  id: string;
  name: string;
  provider: string;
  kind: "on-demand" | "inference-profile" | "application-profile";
  baseModelId?: string;
  legacy?: boolean;
}

export type BedrockListModelsResult =
  { ok: true; models: BedrockModelOptionInfo[] } | { ok: false; error: string };

/**
 * Whether the account lists the `global.` inference profile of a configured
 * Bedrock model that uses a regional ID. "unknown" when nothing could be
 * checked (not a Bedrock model, no regional prefix, or the listing failed).
 */
export type BedrockGlobalProfileStatus = "present" | "absent" | "unknown";

export type BedrockTestModelResult =
  | { ok: true; modelId: string; latencyMs: number; reply: string }
  | { ok: false; error: string };

export type ProfileFileResult =
  { ok: true; profileId?: string } | { ok: false; error: string };

export type ToCoreFromIdeOrWebviewProtocol = {
  // Special
  ping: [string, string];
  abort: [undefined, void];
  cancelApply: [undefined, void];

  // History
  "history/list": [ListHistoryOptions, BaseSessionMetadata[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, Session];
  "history/save": [Session, void];
  "history/share": [{ id: string; outputDir?: string }, void];
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
  "config/addLocalWorkspaceBlock": [
    { blockType: BlockType; baseFilename?: string },
    void,
  ];
  "config/addGlobalRule": [undefined | { baseFilename?: string }, void];
  "config/deleteRule": [{ filepath: string }, void];
  "config/newPromptFile": [undefined, void];
  "config/newAssistantFile": [undefined, void];
  /** Create a config (or a copy of `copyFrom`) and select it. */
  "config/createProfile": [
    {
      name: string;
      location: "global" | "workspace";
      copyFrom?: string;
    },
    ProfileFileResult,
  ];
  /** Rename a config; its id changes unless it is the main config. */
  "config/renameProfile": [
    { profileId: string; name: string },
    ProfileFileResult,
  ];
  /** Delete a config file; the main config cannot be deleted. */
  "config/deleteProfile": [{ profileId: string }, ProfileFileResult];
  "config/ideSettingsUpdate": [IdeSettings, void];
  "config/getSerializedProfileInfo": [
    undefined,
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string | null;
      profiles: ProfileDescription[];
    },
  ];
  "config/deleteModel": [{ title: string }, void];
  /**
   * Write `modeModels` in the global config.yaml (comments kept). Returns
   * whether a config.yaml was edited; false means there was none to edit.
   */
  "config/setModeModels": [ModeModelsInput, { saved: boolean }];
  /**
   * Switch rules on or off per mode in the global config.yaml (comments kept).
   * `null` removes a mode's entry. Returns false when there is no config.yaml.
   */
  "config/setRulesByMode": [RulesByModeInput, { saved: boolean }];
  /**
   * Add one rule to `toolPermissions` in the global config.yaml (comments
   * kept). "no-config" means the selected config is not a local YAML file.
   */
  "config/addToolRule": [
    { decision: "allow" | "ask" | "deny"; rule: string },
    { result: "added" | "exists" | "no-config" | "invalid" },
  ];
  /**
   * The narrowest allow rule for a pending tool call, or why there is none.
   * Nothing is written; "Always allow" then sends the rule to config/addToolRule.
   */
  "tools/suggestAllowRule": [
    { toolName: string; parsedArgs: Record<string, unknown> },
    (
      | {
          ok: true;
          rule: string;
          summary: string;
          /** The tool's own safety check would still ask; confirm before saving. */
          loosensCheck?: boolean;
        }
      | { ok: false; reason: string }
    ),
  ];
  "config/refreshProfiles": [
    (
      | undefined
      | {
          reason?: string;
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
  /**
   * Take the user to where a secret that is missing on this machine must be
   * set: the .env file (created with an empty `NAME=` line), or the line of
   * the config that uses it.
   */
  /** Configured models grouped by provider connection. Never returns a key. */
  "config/getProviderSetup": [undefined, ProviderSetupInfo];
  /**
   * Add and remove models of one provider connection in config.yaml and, when
   * `key` is given, store the key where the user chose. The key value is
   * never written to config.yaml unless storage is "inline".
   */
  "config/saveProviderModels": [
    SaveProviderModelsRequest,
    SaveProviderModelsResult,
  ];
  /**
   * Find Cline and Roo Code MCP settings files and say what importing each
   * server would do. Lists secret names only, never values.
   */
  "config/previewMcpImport": [undefined, McpImportPreview];
  /**
   * Add the chosen servers from a detected Cline / Roo Code settings file to
   * config.yaml. Credentials become ${{ secrets.NAME }} references.
   */
  "config/importMcpServers": [McpImportRequest, McpImportResult];
  /** Store one secret (secure storage or ~/.continue/.env) and reload. */
  "config/setSecret": [
    { secretName: string; value: string; storage: "secure" | "env" },
    {
      stored: boolean;
      error?: string;
      warning?: string;
      /** The name also has a plaintext copy in ~/.continue/.env. */
      envShadowed?: boolean;
    },
  ];
  /**
   * Remove a secret's line from ~/.continue/.env. Only sent after the user
   * agreed, and only honored when the value is in secure storage.
   */
  /**
   * Move a key from ~/.continue/.env to secure storage, then remove the .env
   * line. The value is handled in core and never returned. config.yaml keeps
   * its `${{ secrets.NAME }}` reference.
   */
  "config/moveKeyToSecureStorage": [
    { secretName: string },
    { moved: boolean; envRemoved?: boolean; error?: string },
  ];
  "config/removeEnvSecret": [
    { secretName: string },
    { removed: boolean; error?: string },
  ];
  /** Provider instances (providers.yaml), with key state but no values. */
  "providers/list": [undefined, ProviderInstancesInfo];
  /** Add or edit an instance in ~/.continue/providers.yaml. */
  "providers/save": [SaveProviderInstanceRequest, SaveProviderInstanceResult];
  /** Remove an instance from ~/.continue/providers.yaml (its key is kept). */
  "providers/delete": [{ name: string }, { deleted: boolean; error?: string }];
  /** Add a model that uses a provider instance to the selected config. */
  "config/addConnectedModel": [
    { connection: string; model: string; name?: string; roles?: string[] },
    { saved: boolean; error?: string },
  ];
  /** API keys written as plain text in local configs and providers files. */
  "config/findPlaintextKeys": [
    undefined,
    { keys: PlaintextKey[]; secureStorageAvailable: boolean },
  ];
  /**
   * Store the chosen plaintext keys as secrets and replace each with a
   * `${{ secrets.NAME }}` reference. Values never leave core.
   */
  "config/movePlaintextKeys": [
    { ids: string[]; storage: "secure" | "env" },
    MovePlaintextKeysResult,
  ];
  "config/openSecretLocation": [
    { secretName: string; target: "env" | "configLine" },
    void,
  ];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
      isInAgentMode: boolean;
    },
    ContextItemWithId[],
  ];

  "mcp/reloadServer": [
    {
      id: string;
    },
    void,
  ];
  "mcp/setServerEnabled": [{ id: string; enabled: boolean }, void];
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
  "mcp/startAuthentication": [
    {
      serverId: string;
      serverUrl: string;
    },
    void,
  ];
  "mcp/removeAuthentication": [
    {
      serverId: string;
      serverUrl: string;
    },
    void,
  ];
  "context/getSymbolsForFiles": [{ uris: string[] }, FileSymbolMap];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "autocomplete/complete": [AutocompleteInput, string[]];
  "context/addDocs": [SiteIndexingConfig, void];
  "context/removeDocs": [Pick<SiteIndexingConfig, "startUrl">, void];
  "context/indexDocs": [{ reIndex: boolean }, void];
  "autocomplete/cancel": [undefined, void];
  "autocomplete/accept": [{ completionId: string }, void];
  "nextEdit/predict": [
    {
      input: AutocompleteInput;
      options?: {
        withChain?: boolean;
        usingFullFileDiff?: boolean;
      };
    },
    NextEditOutcome | undefined,
  ];
  "nextEdit/reject": [{ completionId: string }, void];
  "nextEdit/accept": [{ completionId: string }, void];
  "nextEdit/startChain": [undefined, void];
  "nextEdit/deleteChain": [undefined, void];
  "nextEdit/isChainAlive": [undefined, boolean];
  "nextEdit/queue/getProcessedCount": [undefined, number];
  "nextEdit/queue/dequeueProcessed": [undefined, ProcessedItem | null];
  "nextEdit/queue/processOne": [
    {
      ctx: {
        completionId: string;
        manuallyPassFileContents?: string;
        manuallyPassPrefix?: string;
        selectedCompletionInfo?: {
          text: string;
          range: Range;
        };
        isUntitledFile: boolean;
        recentlyVisitedRanges: AutocompleteCodeSnippet[];
        recentlyEditedRanges: RecentlyEditedRange[];
      };
      recentlyVisitedRanges: AutocompleteCodeSnippet[];
      recentlyEditedRanges: RecentlyEditedRange[];
    },
    void,
  ];
  "nextEdit/queue/clear": [undefined, void];
  "nextEdit/queue/abort": [undefined, void];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: LLMFullCompletionOptions;
      title: string;
    },
    string,
  ];
  "llm/listModels": [{ title: string }, string[] | undefined];
  "bedrock/listModels": [BedrockConnectionParams, BedrockListModelsResult];
  "bedrock/globalProfile": [{ title: string }, BedrockGlobalProfileStatus];
  "bedrock/testModel": [
    BedrockConnectionParams & { model: string },
    BedrockTestModelResult,
  ];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: LLMFullCompletionOptions;
      title: string;
      messageOptions?: MessageOption;
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
  getDiffLines: [{ oldContent: string; newContent: string }, DiffLine[]];
  "llm/compileChat": [
    { messages: ChatMessage[]; options: LLMFullCompletionOptions },
    CompiledMessagesResult,
  ];
  "chatDescriber/describe": [
    {
      text: string;
    },
    string | undefined,
  ];
  "conversation/compact": [
    {
      index: number;
      sessionId: string;
      /**
       * The conversation as the chat last sent it, so the summary request can
       * read a warm prompt cache. Sent only when that is worth doing.
       */
      prefix?: {
        messages: ChatMessage[];
        options: LLMFullCompletionOptions;
      };
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
  "docs/getIndexedPages": [{ startUrl: string }, string[]];
  addAutocompleteModel: [{ model: ModelDescription }, void];

  "auth/getAuthUrl": [{ useOnboarding: boolean }, { url: string }];
  /** Subagent definitions, read fresh from the agent folders on each call. */
  "subagents/list": [undefined, SubagentLoadResult];
  "tools/call": [
    { toolCall: ToolCall },
    {
      contextItems: ContextItem[];
      errorMessage?: string;
      errorReason?: ContinueErrorReason;
      mcpUiState?: McpUiState;
    },
  ];
  "tools/evaluatePolicy": [
    {
      toolName: string;
      basePolicy: ToolPolicy;
      parsedArgs: Record<string, unknown>;
      processedArgs?: Record<string, unknown>;
      /** Approval mode and switches; absent means Manual. */
      approval?: ApprovalSettings;
    },
    {
      policy: ToolPolicy;
      displayValue?: string;
      /** Set only when the user has toolPermissions rules. */
      source?: ToolDecisionSource;
      /** A sentence saying why, for the prompt or the refusal. */
      reason?: string;
      /** The rule that decided, as written in config.yaml. */
      rule?: string;
    },
  ];
  /**
   * Auto approval (experimental): decide one call. Core re-runs the rules
   * first; only a call they leave open reaches the reviewer model.
   */
  "tools/autoReview": [AutoReviewRequest, AutoReviewReply];
  "tools/preprocessArgs": [
    { toolName: string; args: Record<string, unknown> },
    {
      preprocessedArgs?: Record<string, unknown>;
      errorReason?: ContinueErrorReason;
      errorMessage?: string;
    },
  ];
  "clipboardCache/add": [{ content: string }, void];
  isItemTooBig: [{ item: ContextItemWithId }, boolean];
  "process/markAsBackgrounded": [{ toolCallId: string }, void];
  "process/isBackgrounded": [{ toolCallId: string }, boolean];
  "process/killTerminalProcess": [{ toolCallId: string }, void];
  "mdm/setLicenseKey": [{ licenseKey: string }, boolean];
  "models/fetch": [
    { provider: string; apiKey?: string; apiBase?: string },
    {
      name: string;
      modelId?: string;
      description?: string;
      icon?: string;
      popular?: boolean;
      contextLength?: number;
      maxTokens?: number;
      supportsTools?: boolean;
      supportsImages?: boolean;
      createdAt?: string;
      deprecated?: boolean;
    }[],
  ];
  /** OpenAI-compatible servers answering on this machine's common ports. */
  "models/detectLocal": [undefined, DetectedLocalServer[]];
  /** Requests the server of this chat model serves at once, when it says. */
  "models/serverConcurrency": [{ title: string }, number | undefined];
};
