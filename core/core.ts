import { fetchwithRequestOptions } from "@continuedev/fetch";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";

import { CompletionProvider } from "./autocomplete/CompletionProvider";
import {
  openedFilesLruCache,
  prevFilepaths,
} from "./autocomplete/util/openedFilesLruCache";
import { ConfigHandler } from "./config/ConfigHandler";
import { SYSTEM_PROMPT_DOT_FILE } from "./config/getWorkspaceContinueRuleDotFiles";
import { addModel, deleteModel } from "./config/util";
import CodebaseContextProvider from "./context/providers/CodebaseContextProvider";
import CurrentFileContextProvider from "./context/providers/CurrentFileContextProvider";
import { ContinueServerClient } from "./continueServer/stubs/client";
import { getAuthUrlForTokenPage } from "./control-plane/auth/index";
import { getControlPlaneEnv } from "./control-plane/env";
import { DevDataSqliteDb } from "./data/devdataSqlite";
import { DataLogger } from "./data/log";
import { CodebaseIndexer } from "./indexing/CodebaseIndexer";
import DocsService from "./indexing/docs/DocsService";
import { countTokens } from "./llm/countTokens";
import Ollama from "./llm/llms/Ollama";
import { createNewPromptFileV2 } from "./promptFiles/createNewPromptFile";
import { callTool } from "./tools/callTool";
import { ChatDescriber } from "./util/chatDescriber";
import { clipboardCache } from "./util/clipboardCache";
import { GlobalContext } from "./util/GlobalContext";
import historyManager from "./util/history";
import { editConfigFile, migrateV1DevDataFiles } from "./util/paths";
import { Telemetry } from "./util/posthog";
import {
  isProcessBackgrounded,
  markProcessAsBackgrounded,
} from "./util/processTerminalBackgroundStates";
import { getSymbolsForManyFiles } from "./util/treeSitter";
import { TTS } from "./util/tts";

import {
  CompleteOnboardingPayload,
  ContextItemWithId,
  IdeSettings,
  ModelDescription,
  RangeInFile,
  ToolCall,
  type ContextItem,
  type ContextItemId,
  type IDE,
} from ".";

import { BLOCK_TYPES, ConfigYaml } from "@continuedev/config-yaml";
import { getDiffFn, GitDiffCache } from "./autocomplete/snippets/gitDiffCache";
import { stringifyMcpPrompt } from "./commands/slash/mcpSlashCommand";
import { isLocalDefinitionFile } from "./config/loadLocalAssistants";
import {
  setupLocalConfig,
  setupProviderConfig,
  setupQuickstartConfig,
} from "./config/onboarding";
import { createNewWorkspaceBlockFile } from "./config/workspace/workspaceBlocks";
import { MCPManagerSingleton } from "./context/mcp/MCPManagerSingleton";
import { setMdmLicenseKey } from "./control-plane/mdm/mdm";
import { ApplyAbortManager } from "./edit/applyAbortManager";
import { streamDiffLines } from "./edit/streamDiffLines";
import { shouldIgnore } from "./indexing/shouldIgnore";
import { walkDirCache } from "./indexing/walkDir";
import { LLMLogger } from "./llm/logger";
import { RULES_MARKDOWN_FILENAME } from "./llm/rules/constants";
import { llmStreamChat } from "./llm/streamChat";
import type { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import { OnboardingModes } from "./protocol/core";
import type { IMessenger, Message } from "./protocol/messenger";
import { getUriPathBasename } from "./util/uri";

const hasRulesFiles = (uris: string[]): boolean => {
  for (const uri of uris) {
    const filename = getUriPathBasename(uri);
    if (filename === RULES_MARKDOWN_FILENAME) {
      return true;
    }
  }
  return false;
};

export class Core {
  configHandler: ConfigHandler;
  codeBaseIndexer: CodebaseIndexer;
  completionProvider: CompletionProvider;
  private docsService: DocsService;
  private globalContext = new GlobalContext();
  llmLogger = new LLMLogger();

  private messageAbortControllers = new Map<string, AbortController>();
  private addMessageAbortController(id: string): AbortController {
    const controller = new AbortController();
    this.messageAbortControllers.set(id, controller);
    controller.signal.addEventListener("abort", () => {
      this.messageAbortControllers.delete(id);
    });
    return controller;
  }
  private abortById(messageId: string) {
    this.messageAbortControllers.get(messageId)?.abort();
  }

  invoke<T extends keyof ToCoreProtocol>(
    messageType: T,
    data: ToCoreProtocol[T][0],
  ): ToCoreProtocol[T][1] {
    return this.messenger.invoke(messageType, data);
  }

  send<T extends keyof FromCoreProtocol>(
    messageType: T,
    data: FromCoreProtocol[T][0],
    messageId?: string,
  ): string {
    return this.messenger.send(messageType, data, messageId);
  }

  // TODO: It shouldn't actually need an IDE type, because this can happen
  // through the messenger (it does in the case of any non-VS Code IDEs already)
  constructor(
    private readonly messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly ide: IDE,
  ) {
    // Ensure .continue directory is created
    migrateV1DevDataFiles();

    const ideInfoPromise = messenger.request("getIdeInfo", undefined);
    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    const sessionInfoPromise = messenger.request("getControlPlaneSessionInfo", {
      silent: true,
      useOnboarding: false,
    });

    this.configHandler = new ConfigHandler(
      this.ide,
      ideSettingsPromise,
      this.llmLogger,
      sessionInfoPromise,
    );

    this.docsService = DocsService.createSingleton(
      this.configHandler,
      this.ide,
      this.messenger,
    );

    MCPManagerSingleton.getInstance().onConnectionsRefreshed = () => {
      void this.configHandler.reloadConfig();

      // Refresh @mention dropdown submenu items for MCP providers
      const mcpManager = MCPManagerSingleton.getInstance();
      const mcpProviderNames = Array.from(mcpManager.connections.keys()).map(
        (mcpId) => `mcp-${mcpId}`,
      );

      if (mcpProviderNames.length > 0) {
        this.messenger.send("refreshSubmenuItems", {
          providers: mcpProviderNames,
        });
      }
    };

    this.codeBaseIndexer = new CodebaseIndexer(
      this.configHandler,
      this.ide,
      this.messenger,
      this.globalContext.get("indexingPaused"),
    );

    this.configHandler.onConfigUpdate((result) => {
      void (async () => {
        const serializedResult = await this.configHandler.getSerializedConfig();
        this.messenger.send("configUpdate", {
          result: serializedResult,
          profileId:
            this.configHandler.currentProfile?.profileDescription.id || null,
          organizations: this.configHandler.getSerializedOrgs(),
          selectedOrgId: this.configHandler.currentOrg.id,
        });

        // update additional submenu context providers registered via VSCode API
        const additionalProviders =
          this.configHandler.getAdditionalSubmenuContextProviders();
        if (additionalProviders.length > 0) {
          this.messenger.send("refreshSubmenuItems", {
            providers: additionalProviders,
          });
        }
      })();
    });

    // Dev Data Logger
    const dataLogger = DataLogger.getInstance();
    dataLogger.core = this;
    dataLogger.ideInfoPromise = ideInfoPromise;
    dataLogger.ideSettingsPromise = ideSettingsPromise;

    void ideSettingsPromise.then((ideSettings) => {
      const continueServerClient = new ContinueServerClient(
        ideSettings.remoteConfigServerUrl,
        ideSettings.userToken,
      );

      // Index on initialization
      void this.ide.getWorkspaceDirs().then(async (dirs) => {
        // Respect pauseCodebaseIndexOnStart user settings
        if (ideSettings.pauseCodebaseIndexOnStart) {
          this.codeBaseIndexer.paused = true;
          void this.messenger.request("indexProgress", {
            progress: 0,
            desc: "Initial Indexing Skipped",
            status: "paused",
          });
          return;
        }

        void this.codeBaseIndexer.refreshCodebaseIndex(dirs);
      });
    });

    const getLlm = async () => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return undefined;
      }
      return config.selectedModelByRole.autocomplete ?? undefined;
    };
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      ide,
      getLlm,
      (e) => {},
      (..._) => Promise.resolve([]),
    );

    this.registerMessageHandlers(ideSettingsPromise);
  }

  /* eslint-disable max-lines-per-function */
  private registerMessageHandlers(ideSettingsPromise: Promise<IdeSettings>) {
    const on = this.messenger.on.bind(this.messenger);

    // Note, VsCode's in-process messenger doesn't do anything with this
    // It will only show for jetbrains
    this.messenger.onError((message, err) => {
      void Telemetry.capture("core_messenger_error", {
        message: err.message,
        stack: err.stack,
      });

      // just to prevent duplicate error messages in jetbrains (same logic in webview protocol)
      if (
        ["llm/streamChat", "chatDescriber/describe"].includes(
          message.messageType,
        )
      ) {
        return;
      } else {
        void this.ide.showToast("error", err.message);
      }
    });

    on("abort", (msg) => {
      this.abortById(msg.data ?? msg.messageId);
    });

    on("ping", (msg) => {
      if (msg.data !== "ping") {
        throw new Error("ping message incorrect");
      }
      return "pong";
    });

    // History
    on("history/list", (msg) => {
      return historyManager.list(msg.data);
    });

    on("history/delete", (msg) => {
      historyManager.delete(msg.data.id);
    });

    on("history/load", (msg) => {
      return historyManager.load(msg.data.id);
    });

    on("history/save", (msg) => {
      historyManager.save(msg.data);
    });

    on("history/clear", (msg) => {
      historyManager.clearAll();
    });

    on("devdata/log", async (msg) => {
      void DataLogger.getInstance().logDevData(msg.data);
    });

    on("config/addModel", (msg) => {
      const model = msg.data.model;
      addModel(model, msg.data.role);
      void this.configHandler.reloadConfig();
    });

    on("config/deleteModel", (msg) => {
      deleteModel(msg.data.title);
      void this.configHandler.reloadConfig();
    });

    on("config/newPromptFile", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      await createNewPromptFileV2(this.ide, config?.experimental?.promptPath);
      await this.configHandler.reloadConfig();
    });

    on("config/addLocalWorkspaceBlock", async (msg) => {
      await createNewWorkspaceBlockFile(this.ide, msg.data.blockType);
      await this.configHandler.reloadConfig();
    });

    on("config/openProfile", async (msg) => {
      await this.configHandler.openConfigProfile(msg.data.profileId);
    });

    on("config/reload", async (msg) => {
      void this.configHandler.reloadConfig();
      return await this.configHandler.getSerializedConfig();
    });

    on("config/ideSettingsUpdate", async (msg) => {
      await this.configHandler.updateIdeSettings(msg.data);
    });

    on("config/refreshProfiles", async (msg) => {
      const { selectOrgId, selectProfileId } = msg.data ?? {};
      await this.configHandler.refreshAll();
      if (selectOrgId) {
        await this.configHandler.setSelectedOrgId(selectOrgId, selectProfileId);
      } else if (selectProfileId) {
        await this.configHandler.setSelectedProfileId(selectProfileId);
      }
    });

    on("config/updateSharedConfig", async (msg) => {
      const newSharedConfig = this.globalContext.updateSharedConfig(msg.data);
      await this.configHandler.reloadConfig();
      return newSharedConfig;
    });

    on("config/updateSelectedModel", async (msg) => {
      const newSelectedModels = this.globalContext.updateSelectedModel(
        msg.data.profileId,
        msg.data.role,
        msg.data.title,
      );
      await this.configHandler.reloadConfig();
      return newSelectedModels;
    });

    on("controlPlane/openUrl", async (msg) => {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      let url = `${env.APP_URL}${msg.data.path}`;
      if (msg.data.orgSlug) {
        url += `?org=${msg.data.orgSlug}`;
      }
      await this.messenger.request("openUrl", url);
    });

    on("controlPlane/getFreeTrialStatus", async (msg) => {
      return this.configHandler.controlPlaneClient.getFreeTrialStatus();
    });

    on("controlPlane/getModelsAddOnUpgradeUrl", async (msg) => {
      return this.configHandler.controlPlaneClient.getModelsAddOnCheckoutUrl(
        msg.data.vsCodeUriScheme,
      );
    });

    on("mcp/reloadServer", async (msg) => {
      await MCPManagerSingleton.getInstance().refreshConnection(msg.data.id);
    });
    on("mcp/getPrompt", async (msg) => {
      const { serverName, promptName, args } = msg.data;
      const prompt = await MCPManagerSingleton.getInstance().getPrompt(
        serverName,
        promptName,
        args,
      );
      const stringifiedPrompt = stringifyMcpPrompt(prompt);
      return {
        prompt: stringifiedPrompt,
        description: prompt.description,
      };
    });
    // Context providers
    on("context/addDocs", async (msg) => {
      void this.docsService.indexAndAdd(msg.data);
    });

    on("context/removeDocs", async (msg) => {
      await this.docsService.delete(msg.data.startUrl);
    });

    on("context/indexDocs", async (msg) => {
      await this.docsService.syncDocsWithPrompt(msg.data.reIndex);
    });

    on("context/loadSubmenuItems", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return [];
      }

      try {
        const items = await config.contextProviders
          ?.find((provider) => provider.description.title === msg.data.title)
          ?.loadSubmenuItems({
            config,
            ide: this.ide,
            fetch: (url, init) =>
              fetchwithRequestOptions(url, init, config.requestOptions),
          });
        return items || [];
      } catch (e) {
        console.error(e);
        return [];
      }
    });

    on("context/getContextItems", this.getContextItems.bind(this));

    on("context/getSymbolsForFiles", async (msg) => {
      const { uris } = msg.data;
      return await getSymbolsForManyFiles(uris, this.ide);
    });

    on("config/getSerializedProfileInfo", async (msg) => {
      return {
        result: await this.configHandler.getSerializedConfig(),
        profileId:
          this.configHandler.currentProfile?.profileDescription.id ?? null,
        organizations: this.configHandler.getSerializedOrgs(),
        selectedOrgId: this.configHandler.currentOrg.id,
      };
    });

    on("clipboardCache/add", (msg) => {
      const added = clipboardCache.add(uuidv4(), msg.data.content);
      if (added) {
        this.messenger.send("refreshSubmenuItems", {
          providers: ["clipboard"],
        });
      }
    });

    on("llm/streamChat", (msg) => {
      const abortController = this.addMessageAbortController(msg.messageId);
      return llmStreamChat(
        this.configHandler,
        abortController,
        msg,
        this.ide,
        this.messenger,
      );
    });

    on("llm/complete", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      const model = config?.selectedModelByRole.chat;
      if (!model) {
        throw new Error("No chat model selected");
      }
      const abortController = this.addMessageAbortController(msg.messageId);

      const completion = await model.complete(
        msg.data.prompt,
        abortController.signal,
        msg.data.completionOptions,
      );
      return completion;
    });
    on("llm/listModels", this.handleListModels.bind(this));

    // Provide messenger to utils so they can interact with GUI + state
    TTS.messenger = this.messenger;
    ChatDescriber.messenger = this.messenger;

    on("tts/kill", async () => {
      void TTS.kill();
    });

    on("chatDescriber/describe", async (msg) => {
      const currentModel = (await this.configHandler.loadConfig()).config
        ?.selectedModelByRole.chat;

      if (!currentModel) {
        throw new Error("No chat model selected");
      }

      return await ChatDescriber.describe(currentModel, {}, msg.data.text);
    });

    // Autocomplete
    on("autocomplete/complete", async (msg) => {
      const outcome =
        await this.completionProvider.provideInlineCompletionItems(
          msg.data,
          undefined,
        );
      return outcome ? [outcome.completion] : [];
    });
    on("autocomplete/accept", async (msg) => {
      this.completionProvider.accept(msg.data.completionId);
    });
    on("autocomplete/cancel", async (msg) => {
      this.completionProvider.cancel();
    });

    on("streamDiffLines", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        throw new Error("Failed to load config");
      }

      const { data } = msg;

      // Title can be an edit, chat, or apply model
      // Fall back to chat
      const llm =
        config.modelsByRole.edit.find((m) => m.title === data.modelTitle) ??
        config.modelsByRole.apply.find((m) => m.title === data.modelTitle) ??
        config.modelsByRole.chat.find((m) => m.title === data.modelTitle) ??
        config.selectedModelByRole.chat;

      if (!llm) {
        throw new Error("No model selected");
      }

      const abortManager = ApplyAbortManager.getInstance();
      const abortController = abortManager.get(
        data.fileUri ?? "current-file-stream",
      ); // not super important since currently cancelling apply will cancel all streams it's one file at a time

      return streamDiffLines({
        highlighted: data.highlighted,
        prefix: data.prefix,
        suffix: data.suffix,
        llm,
        // rules included for edit, NOT apply
        rulesToInclude: data.includeRulesInSystemMessage
          ? config.rules
          : undefined,
        input: data.input,
        language: data.language,
        onlyOneInsertion: false,
        overridePrompt: undefined,
        abortController,
      });
    });

    on("cancelApply", async (msg) => {
      const abortManager = ApplyAbortManager.getInstance();
      abortManager.clear(); // for now abort all streams
    });

    on("onboarding/complete", this.handleCompleteOnboarding.bind(this));

    on("addAutocompleteModel", this.handleAddAutocompleteModel.bind(this));

    on("stats/getTokensPerDay", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerDay();
      return rows;
    });
    on("stats/getTokensPerModel", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerModel();
      return rows;
    });

    on("index/forceReIndex", async ({ data }) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config || config.disableIndexing) {
        return; // TODO silent in case of commands?
      }
      walkDirCache.invalidate();
      if (data?.shouldClearIndexes) {
        await this.codeBaseIndexer.clearIndexes();
      }

      const dirs = data?.dirs ?? (await this.ide.getWorkspaceDirs());
      await this.codeBaseIndexer.refreshCodebaseIndex(dirs);
    });
    on("index/setPaused", (msg) => {
      this.globalContext.update("indexingPaused", msg.data);
      // Update using the new setter instead of token
      this.codeBaseIndexer.paused = msg.data;
    });
    on("index/indexingProgressBarInitialized", async (msg) => {
      // Triggered when progress bar is initialized.
      // If a non-default state has been stored, update the indexing display to that state
      const currentState = this.codeBaseIndexer.currentIndexingState;

      if (currentState.status !== "loading") {
        void this.messenger.request("indexProgress", currentState);
      }
    });

    // File changes - TODO - remove remaining logic for these from IDEs where possible
    on("files/changed", this.handleFilesChanged.bind(this));
    const refreshIfNotIgnored = async (uris: string[]) => {
      const toRefresh: string[] = [];
      for (const uri of uris) {
        const ignore = await shouldIgnore(uri, this.ide);
        if (!ignore) {
          toRefresh.push(uri);
        }
      }
      if (toRefresh.length > 0) {
        this.messenger.send("refreshSubmenuItems", {
          providers: ["file"],
        });
        const { config } = await this.configHandler.loadConfig();
        if (config && !config.disableIndexing) {
          await this.codeBaseIndexer.refreshCodebaseIndexFiles(toRefresh);
        }
      }
    };

    on("files/created", async ({ data }) => {
      if (data?.uris?.length) {
        walkDirCache.invalidate();
        void refreshIfNotIgnored(data.uris);

        if (hasRulesFiles(data.uris)) {
          await this.configHandler.reloadConfig();
        }

        // If it's a local assistant being created, we want to reload all assistants so it shows up in the list
        let localAssistantCreated = false;
        for (const uri of data.uris) {
          if (isLocalDefinitionFile(uri)) {
            localAssistantCreated = true;
          }
        }
        if (localAssistantCreated) {
          await this.configHandler.refreshAll();
        }
      }
    });

    on("files/deleted", async ({ data }) => {
      if (data?.uris?.length) {
        walkDirCache.invalidate();
        void refreshIfNotIgnored(data.uris);

        if (hasRulesFiles(data.uris)) {
          await this.configHandler.reloadConfig();
        }
      }
    });

    on("files/closed", async ({ data }) => {
      try {
        const fileUris = await this.ide.getOpenFiles();
        if (fileUris) {
          const filepaths = fileUris.map((uri) => uri.toString());

          if (!prevFilepaths.filepaths.length) {
            prevFilepaths.filepaths = filepaths;
          }

          // If there is a removal, including if the number of tabs is the same (which can happen with temp tabs)
          if (filepaths.length <= prevFilepaths.filepaths.length) {
            // Remove files from cache that are no longer open (i.e. in the cache but not in the list of opened tabs)
            for (const [key, _] of openedFilesLruCache.entriesDescending()) {
              if (!filepaths.includes(key)) {
                openedFilesLruCache.delete(key);
              }
            }
          }
          prevFilepaths.filepaths = filepaths;
        }
      } catch (e) {
        console.error(
          `didChangeVisibleTextEditors: failed to update openedFilesLruCache`,
        );
      }

      if (data.uris) {
        this.messenger.send("didCloseFiles", {
          uris: data.uris,
        });
      }
    });

    on("files/opened", async ({ data: { uris } }) => {
      if (uris) {
        for (const filepath of uris) {
          try {
            const ignore = await shouldIgnore(filepath, this.ide);
            if (!ignore) {
              // Set the active file as most recently used (need to force recency update by deleting and re-adding)
              if (openedFilesLruCache.has(filepath)) {
                openedFilesLruCache.delete(filepath);
              }
              openedFilesLruCache.set(filepath, filepath);
            }
          } catch (e) {
            console.error(
              `files/opened: failed to update openedFiles cache for ${filepath}`,
            );
          }
        }
      }
    });

    // Docs, etc. indexing
    on("indexing/reindex", async (msg) => {
      if (msg.data.type === "docs") {
        void this.docsService.reindexDoc(msg.data.id);
      }
    });
    on("indexing/abort", async (msg) => {
      if (msg.data.type === "docs") {
        this.docsService.abort(msg.data.id);
      }
    });
    on("indexing/setPaused", async (msg) => {
      if (msg.data.type === "docs") {
      }
    });
    on("docs/initStatuses", async (msg) => {
      void this.docsService.initStatuses();
    });
    on("docs/getDetails", async (msg) => {
      return await this.docsService.getDetails(msg.data.startUrl);
    });

    on("didChangeSelectedProfile", async (msg) => {
      if (msg.data.id) {
        await this.configHandler.setSelectedProfileId(msg.data.id);
      }
    });

    on("didChangeSelectedOrg", async (msg) => {
      if (msg.data.id) {
        await this.configHandler.setSelectedOrgId(
          msg.data.id,
          msg.data.profileId || undefined,
        );
      }
    });

    on("didChangeControlPlaneSessionInfo", async (msg) => {
      this.messenger.send("sessionUpdate", {
        sessionInfo: msg.data.sessionInfo,
      });
      await this.configHandler.updateControlPlaneSessionInfo(
        msg.data.sessionInfo,
      );
    });

    on("auth/getAuthUrl", async (msg) => {
      const url = await getAuthUrlForTokenPage(
        ideSettingsPromise,
        msg.data.useOnboarding,
      );
      return { url };
    });

    on("tools/call", async ({ data: { toolCall } }) =>
      this.handleToolCall(toolCall),
    );

    on("isItemTooBig", async ({ data: { item } }) => {
      return this.isItemTooBig(item);
    });

    // Process state handlers
    on("process/markAsBackgrounded", async ({ data: { toolCallId } }) => {
      markProcessAsBackgrounded(toolCallId);
    });

    on(
      "process/isBackgrounded",
      async ({ data: { toolCallId }, messageId }) => {
        const isBackgrounded = isProcessBackgrounded(toolCallId);
        return isBackgrounded; // Return true to indicate the message was handled successfully
      },
    );

    on("mdm/setLicenseKey", ({ data: { licenseKey } }) => {
      const isValid = setMdmLicenseKey(licenseKey);
      return isValid;
    });
  }

  private async handleToolCall(toolCall: ToolCall) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      throw new Error("Config not loaded");
    }

    const tool = config.tools.find(
      (t) => t.function.name === toolCall.function.name,
    );

    if (!tool) {
      throw new Error(`Tool ${toolCall.function.name} not found`);
    }

    if (!config.selectedModelByRole.chat) {
      throw new Error("No chat model selected");
    }

    // Define a callback for streaming output updates
    const onPartialOutput = (params: {
      toolCallId: string;
      contextItems: ContextItem[];
    }) => {
      this.messenger.send("toolCallPartialOutput", params);
    };

    return await callTool(tool, toolCall, {
      config,
      ide: this.ide,
      llm: config.selectedModelByRole.chat,
      fetch: (url, init) =>
        fetchwithRequestOptions(url, init, config.requestOptions),
      tool,
      toolCallId: toolCall.id,
      onPartialOutput,
      codeBaseIndexer: this.codeBaseIndexer,
    });
  }

  private async isItemTooBig(item: ContextItemWithId) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return false;
    }

    const llm = config?.selectedModelByRole.chat;
    if (!llm) {
      throw new Error("No chat model selected");
    }

    const tokens = countTokens(item.content, llm.model);

    if (tokens > llm.contextLength - llm.completionOptions!.maxTokens!) {
      return true;
    }

    return false;
  }

  private handleAddAutocompleteModel(
    msg: Message<{
      model: ModelDescription;
    }>,
  ) {
    const model = msg.data.model;
    editConfigFile(
      (config) => {
        return {
          ...config,
          tabAutocompleteModel: model,
        };
      },
      (config) => ({
        ...config,
        models: [
          ...(config.models ?? []),
          {
            name: model.title,
            provider: model.provider,
            model: model.model,
            apiKey: model.apiKey,
            roles: ["autocomplete"],
            apiBase: model.apiBase,
          },
        ],
      }),
    );
    void this.configHandler.reloadConfig();
  }

  private async handleFilesChanged({
    data,
  }: Message<{
    uris?: string[];
  }>): Promise<void> {
    if (data?.uris?.length) {
      const diffCache = GitDiffCache.getInstance(getDiffFn(this.ide));
      diffCache.invalidate();
      walkDirCache.invalidate(); // safe approach for now - TODO - only invalidate on relevant changes
      for (const uri of data.uris) {
        const currentProfileUri =
          this.configHandler.currentProfile?.profileDescription.uri ?? "";

        if (URI.equal(uri, currentProfileUri)) {
          // Trigger a toast notification to provide UI feedback that config has been updated
          const showToast =
            this.globalContext.get("showConfigUpdateToast") ?? true;
          if (showToast) {
            const selection = await this.ide.showToast(
              "info",
              "Config updated",
              "Don't show again",
            );
            if (selection === "Don't show again") {
              this.globalContext.update("showConfigUpdateToast", false);
            }
          }
          await this.configHandler.reloadConfig();
          continue;
        }

        if (
          uri.endsWith(".continuerc.json") ||
          uri.endsWith(".prompt") ||
          uri.endsWith(SYSTEM_PROMPT_DOT_FILE) ||
          (uri.includes(".continue") && uri.endsWith(".yaml")) ||
          uri.endsWith(RULES_MARKDOWN_FILENAME) ||
          BLOCK_TYPES.some(
            (blockType) =>
              uri.includes(`.continue/${blockType}`) ||
              uri.includes(`.continue\\${blockType}`),
          )
        ) {
          await this.configHandler.reloadConfig();
        } else if (
          uri.endsWith(".continueignore") ||
          uri.endsWith(".gitignore")
        ) {
          // Reindex the workspaces
          this.invoke("index/forceReIndex", {
            shouldClearIndexes: true,
          });
        } else {
          const { config } = await this.configHandler.loadConfig();
          if (config && !config.disableIndexing) {
            // Reindex the file
            const ignore = await shouldIgnore(uri, this.ide);
            if (!ignore) {
              await this.codeBaseIndexer.refreshCodebaseIndexFiles([uri]);
            }
          }
        }
      }
    }
  }

  private async handleListModels(msg: Message<{ title: string }>) {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return [];
    }

    const model =
      config.modelsByRole.chat.find(
        (model) => model.title === msg.data.title,
      ) ??
      config.modelsByRole.chat.find((model) =>
        model.title?.startsWith(msg.data.title),
      );

    try {
      if (model) {
        return await model.listModels();
      } else {
        if (msg.data.title === "Ollama") {
          const models = await new Ollama({ model: "" }).listModels();
          return models;
        } else {
          return undefined;
        }
      }
    } catch (e) {
      console.debug(`Error listing Ollama models: ${e}`);
      return undefined;
    }
  }

  private async handleCompleteOnboarding(
    msg: Message<CompleteOnboardingPayload>,
  ) {
    const { mode, provider, apiKey } = msg.data;

    let editConfigYamlCallback: (config: ConfigYaml) => ConfigYaml;

    switch (mode) {
      case OnboardingModes.LOCAL:
        editConfigYamlCallback = setupLocalConfig;
        break;

      case OnboardingModes.API_KEY:
        if (provider && apiKey) {
          editConfigYamlCallback = (config: ConfigYaml) =>
            setupProviderConfig(config, provider, apiKey);
        } else {
          editConfigYamlCallback = setupQuickstartConfig;
        }
        break;

      default:
        console.error(`Invalid mode: ${mode}`);
        editConfigYamlCallback = (config) => config;
    }

    editConfigFile((c) => c, editConfigYamlCallback);

    void this.configHandler.reloadConfig();
  }

  private getContextItems = async (
    msg: Message<{
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    }>,
  ) => {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return [];
    }

    const { name, query, fullInput, selectedCode } = msg.data;

    const llm = (await this.configHandler.loadConfig()).config
      ?.selectedModelByRole.chat;

    if (!llm) {
      throw new Error("No chat model selected");
    }

    const provider =
      config.contextProviders?.find(
        (provider) => provider.description.title === name,
      ) ??
      [
        // user doesn't need these in their config.json for the shortcuts to work
        // option+enter
        new CurrentFileContextProvider({}),
        // cmd+enter
        new CodebaseContextProvider({}),
      ].find((provider) => provider.description.title === name);
    if (!provider) {
      return [];
    }

    try {
      const id: ContextItemId = {
        providerTitle: provider.description.title,
        itemId: uuidv4(),
      };

      const items = await provider.getContextItems(query, {
        config,
        llm,
        embeddingsProvider: config.selectedModelByRole.embed,
        fullInput,
        ide: this.ide,
        selectedCode,
        reranker: config.selectedModelByRole.rerank,
        fetch: (url, init) =>
          fetchwithRequestOptions(url, init, config.requestOptions),
      });

      void Telemetry.capture(
        "useContextProvider",
        {
          name: provider.description.title,
        },
        true,
      );

      return items.map((item) => ({
        ...item,
        id,
      }));
    } catch (e) {
      let knownError = false;

      if (e instanceof Error) {
        // After removing transformers JS embeddings provider from jetbrains
        // Should no longer see this error
        // if (e.message.toLowerCase().includes("embeddings provider")) {
        //   knownError = true;
        //   const toastOption = "See Docs";
        //   void this.ide
        //     .showToast(
        //       "error",
        //       `Set up an embeddings model to use @${name}`,
        //       toastOption,
        //     )
        //     .then((userSelection) => {
        //       if (userSelection === toastOption) {
        //         void this.ide.openUrl(
        //           "https://docs.continue.dev/customize/model-roles/embeddings",
        //         );
        //       }
        //     });
        // }
      }
      if (!knownError) {
        void this.ide.showToast(
          "error",
          `Error getting context items from ${name}: ${e}`,
        );
      }
      return [];
    }
  };
}
