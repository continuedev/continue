import { fetchwithRequestOptions } from "@continuedev/fetch";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";

import { CompletionProvider } from "./autocomplete/CompletionProvider";
import { ConfigHandler } from "./config/ConfigHandler";
import { SYSTEM_PROMPT_DOT_FILE } from "./config/getSystemPromptDotFile";
import {
  setupBestConfig,
  setupLocalConfig,
  setupQuickstartConfig,
} from "./config/onboarding";
import { addModel, deleteModel } from "./config/util";
import CodebaseContextProvider from "./context/providers/CodebaseContextProvider";
import CurrentFileContextProvider from "./context/providers/CurrentFileContextProvider";
import { recentlyEditedFilesCache } from "./context/retrieval/recentlyEditedFilesCache";
import { ContinueServerClient } from "./continueServer/stubs/client";
import { getAuthUrlForTokenPage } from "./control-plane/auth/index";
import { getControlPlaneEnv } from "./control-plane/env";
import { DevDataSqliteDb } from "./data/devdataSqlite";
import { DataLogger } from "./data/log";
import { streamDiffLines } from "./edit/streamDiffLines";
import { CodebaseIndexer, PauseToken } from "./indexing/CodebaseIndexer";
import DocsService from "./indexing/docs/DocsService";
import Ollama from "./llm/llms/Ollama";
import { createNewPromptFileV2 } from "./promptFiles/v2/createNewPromptFile";
import { callTool } from "./tools/callTool";
import { ChatDescriber } from "./util/chatDescriber";
import { clipboardCache } from "./util/clipboardCache";
import { GlobalContext } from "./util/GlobalContext";
import historyManager from "./util/history";
import { editConfigFile, migrateV1DevDataFiles } from "./util/paths";
import { Telemetry } from "./util/posthog";
import { getSymbolsForManyFiles } from "./util/treeSitter";
import { TTS } from "./util/tts";

import {
  DiffLine,
  type ContextItemId,
  type IDE,
  type IndexingProgressUpdate,
} from ".";

import { ConfigYaml } from "@continuedev/config-yaml";
import { isLocalAssistantFile } from "./config/loadLocalAssistants";
import { MCPManagerSingleton } from "./context/mcp";
import { shouldIgnore } from "./indexing/shouldIgnore";
import { walkDirCache } from "./indexing/walkDir";
import { llmStreamChat } from "./llm/streamChat";
import type { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import type { IMessenger, Message } from "./protocol/messenger";

export class Core {
  configHandler: ConfigHandler;
  codebaseIndexerPromise: Promise<CodebaseIndexer>;
  completionProvider: CompletionProvider;
  continueServerClientPromise: Promise<ContinueServerClient>;
  codebaseIndexingState: IndexingProgressUpdate;
  private docsService: DocsService;
  private globalContext = new GlobalContext();

  private readonly indexingPauseToken = new PauseToken(
    this.globalContext.get("indexingPaused") === true,
  );

  private abortedMessageIds: Set<string> = new Set();

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
    private readonly onWrite: (text: string) => Promise<void> = async () => {},
  ) {
    // Ensure .continue directory is created
    migrateV1DevDataFiles();

    this.codebaseIndexingState = {
      status: "loading",
      desc: "loading",
      progress: 0,
    };

    const ideInfoPromise = messenger.request("getIdeInfo", undefined);
    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    const sessionInfoPromise = messenger.request("getControlPlaneSessionInfo", {
      silent: true,
      useOnboarding: false,
    });

    this.configHandler = new ConfigHandler(
      this.ide,
      ideSettingsPromise,
      this.onWrite,
      sessionInfoPromise,
      (orgId: string | null) => {
        void messenger.request("didSelectOrganization", {
          orgId,
        });
      },
    );

    this.docsService = DocsService.createSingleton(
      this.configHandler,
      this.ide,
      this.messenger,
    );

    const mcpManager = MCPManagerSingleton.getInstance();
    mcpManager.onConnectionsRefreshed = async () => {
      // This ensures that it triggers a NEW load after waiting for config promise to finish
      await this.configHandler.loadConfig();
      await this.configHandler.reloadConfig();
    };

    this.configHandler.onConfigUpdate(async (result) => {
      const serializedResult = await this.configHandler.getSerializedConfig();
      this.messenger.send("configUpdate", {
        result: serializedResult,
        profileId:
          this.configHandler.currentProfile?.profileDescription.id ?? null,
      });

      // update additional submenu context providers registered via VSCode API
      const additionalProviders =
        this.configHandler.getAdditionalSubmenuContextProviders();
      if (additionalProviders.length > 0) {
        this.messenger.send("refreshSubmenuItems", {
          providers: additionalProviders,
        });
      }
    });

    this.configHandler.onDidChangeAvailableProfiles(
      (profiles, selectedProfileId) =>
        this.messenger.send("didChangeAvailableProfiles", {
          profiles,
          selectedProfileId,
        }),
    );

    // Dev Data Logger
    const dataLogger = DataLogger.getInstance();
    dataLogger.core = this;
    dataLogger.ideInfoPromise = ideInfoPromise;
    dataLogger.ideSettingsPromise = ideSettingsPromise;

    // Codebase Indexer and ContinueServerClient depend on IdeSettings
    let codebaseIndexerResolve: (_: any) => void | undefined;
    this.codebaseIndexerPromise = new Promise(
      async (resolve) => (codebaseIndexerResolve = resolve),
    );

    let continueServerClientResolve: (_: any) => void | undefined;
    this.continueServerClientPromise = new Promise(
      (resolve) => (continueServerClientResolve = resolve),
    );

    void ideSettingsPromise.then((ideSettings) => {
      const continueServerClient = new ContinueServerClient(
        ideSettings.remoteConfigServerUrl,
        ideSettings.userToken,
      );
      continueServerClientResolve(continueServerClient);

      codebaseIndexerResolve(
        new CodebaseIndexer(
          this.configHandler,
          this.ide,
          this.indexingPauseToken,
          continueServerClient,
        ),
      );

      // Index on initialization
      void this.ide.getWorkspaceDirs().then(async (dirs) => {
        // Respect pauseCodebaseIndexOnStart user settings
        if (ideSettings.pauseCodebaseIndexOnStart) {
          this.indexingPauseToken.paused = true;
          void this.messenger.request("indexProgress", {
            progress: 0,
            desc: "Initial Indexing Skipped",
            status: "paused",
          });
          return;
        }

        void this.refreshCodebaseIndex(dirs);
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

    const on = this.messenger.on.bind(this.messenger);

    // Note, VsCode's in-process messenger doesn't do anything with this
    // It will only show for jetbrains
    this.messenger.onError((message, err) => {
      void Telemetry.capture("core_messenger_error", {
        message: err.message,
        stack: err.stack,
      });

      // Again, specifically for jetbrains to prevent duplicate error messages
      // The same logic can currently be found in the webview protocol
      // bc streaming errors are handled in the GUI
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

    // Special
    on("abort", (msg) => {
      this.abortedMessageIds.add(msg.messageId);
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

    // Dev data
    on("devdata/log", async (msg) => {
      void DataLogger.getInstance().logDevData(msg.data);
    });

    // Edit config
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

    on("config/openProfile", async (msg) => {
      await this.configHandler.openConfigProfile(msg.data.profileId);
    });

    on("config/reload", async (msg) => {
      void this.configHandler.reloadConfig();
      return await this.configHandler.getSerializedConfig();
    });

    on("config/ideSettingsUpdate", (msg) => {
      this.configHandler.updateIdeSettings(msg.data);
    });

    on("config/listProfiles", async (msg) => {
      const profiles = this.configHandler.listProfiles();
      const selectedProfileId =
        this.configHandler.currentProfile?.profileDescription.id ?? null;
      return { profiles, selectedProfileId };
    });

    on("config/refreshProfiles", async (msg) => {
      await this.configHandler.loadAssistantsForSelectedOrg();
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

    on("controlPlane/listOrganizations", async (msg) => {
      return await this.configHandler.listOrganizations();
    });

    on("mcp/reloadServer", async (msg) => {
      mcpManager.refreshConnection(msg.data.id);
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

      const items = await config.contextProviders
        ?.find((provider) => provider.description.title === msg.data.title)
        ?.loadSubmenuItems({
          config,
          ide: this.ide,
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
        });
      return items || [];
    });

    on("context/getContextItems", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return [];
      }

      const { name, query, fullInput, selectedCode, selectedModelTitle } =
        msg.data;

      const llm = await this.configHandler.llmFromTitle(selectedModelTitle);
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
          ide,
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
    });

    on("context/getSymbolsForFiles", async (msg) => {
      const { uris } = msg.data;
      return await getSymbolsForManyFiles(uris, this.ide);
    });

    on("config/getSerializedProfileInfo", async (msg) => {
      return {
        result: await this.configHandler.getSerializedConfig(),
        profileId:
          this.configHandler.currentProfile?.profileDescription.id ?? null,
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

    on("llm/streamChat", (msg) =>
      llmStreamChat(
        this.configHandler,
        this.abortedMessageIds,
        msg,
        ide,
        this.messenger,
      ),
    );

    on("llm/complete", async (msg) => {
      const model = await this.configHandler.llmFromTitle(msg.data.title);
      const completion = await model.complete(
        msg.data.prompt,
        new AbortController().signal,
        msg.data.completionOptions,
      );
      return completion;
    });
    on("llm/listModels", async (msg) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config) {
        return [];
      }

      const model =
        config.models.find((model) => model.title === msg.data.title) ??
        config.models.find((model) => model.title?.startsWith(msg.data.title));
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
    });

    // Provide messenger to utils so they can interact with GUI + state
    TTS.messenger = this.messenger;
    ChatDescriber.messenger = this.messenger;

    on("tts/kill", async () => {
      void TTS.kill();
    });

    on("chatDescriber/describe", async (msg) => {
      const currentModel = await this.configHandler.llmFromTitle(
        msg.data.selectedModelTitle,
      );
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

    async function* streamDiffLinesGenerator(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["streamDiffLines"][0]>,
    ): AsyncGenerator<DiffLine> {
      const data = msg.data;
      const llm = await configHandler.llmFromTitle(msg.data.modelTitle);
      for await (const diffLine of streamDiffLines(
        data.prefix,
        data.highlighted,
        data.suffix,
        llm,
        data.input,
        data.language,
        false,
        undefined,
      )) {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          break;
        }
        yield diffLine;
      }
    }

    on("streamDiffLines", (msg) =>
      streamDiffLinesGenerator(this.configHandler, this.abortedMessageIds, msg),
    );

    on("completeOnboarding", (msg) => {
      const mode = msg.data.mode;

      if (mode === "Custom") {
        return;
      }

      let editConfigYamlCallback: (config: ConfigYaml) => ConfigYaml;

      switch (mode) {
        case "Local":
          editConfigYamlCallback = setupLocalConfig;
          break;

        case "Quickstart":
          editConfigYamlCallback = setupQuickstartConfig;
          break;

        case "Best":
          editConfigYamlCallback = setupBestConfig;
          break;

        default:
          console.error(`Invalid mode: ${mode}`);
          editConfigYamlCallback = (config) => config;
      }

      editConfigFile((c) => c, editConfigYamlCallback);

      void this.configHandler.reloadConfig();
    });

    on("addAutocompleteModel", (msg) => {
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
    });

    on("stats/getTokensPerDay", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerDay();
      return rows;
    });
    on("stats/getTokensPerModel", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerModel();
      return rows;
    });

    // Codebase indexing
    on("index/forceReIndex", async ({ data }) => {
      const { config } = await this.configHandler.loadConfig();
      if (!config || config.disableIndexing) {
        return; // TODO silent in case of commands?
      }
      walkDirCache.invalidate();
      if (data?.shouldClearIndexes) {
        const codebaseIndexer = await this.codebaseIndexerPromise;
        await codebaseIndexer.clearIndexes();
      }

      const dirs = data?.dirs ?? (await this.ide.getWorkspaceDirs());
      await this.refreshCodebaseIndex(dirs);
    });
    on("index/setPaused", (msg) => {
      this.globalContext.update("indexingPaused", msg.data);
      this.indexingPauseToken.paused = msg.data;
    });
    on("index/indexingProgressBarInitialized", async (msg) => {
      // Triggered when progress bar is initialized.
      // If a non-default state has been stored, update the indexing display to that state
      if (this.codebaseIndexingState.status !== "loading") {
        void this.messenger.request(
          "indexProgress",
          this.codebaseIndexingState,
        );
      }
    });

    // File changes
    // TODO - remove remaining logic for these from IDEs where possible
    on("files/changed", async ({ data }) => {
      if (data?.uris?.length) {
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
            uri.endsWith(SYSTEM_PROMPT_DOT_FILE)
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
                await this.refreshCodebaseIndexFiles([uri]);
              }
            }
          }
        }
      }
    });

    const refreshIfNotIgnored = async (uris: string[]) => {
      const toRefresh: string[] = [];
      for (const uri of uris) {
        const ignore = await shouldIgnore(uri, ide);
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
          await this.refreshCodebaseIndexFiles(toRefresh);
        }
      }
    };

    on("files/created", async ({ data }) => {
      if (data?.uris?.length) {
        walkDirCache.invalidate();
        void refreshIfNotIgnored(data.uris);

        // If it's a local assistant being created, we want to reload all assistants so it shows up in the list
        for (const uri of data.uris) {
          if (isLocalAssistantFile(uri)) {
            await this.configHandler.loadAssistantsForSelectedOrg();
          }
        }
      }
    });

    on("files/deleted", async ({ data }) => {
      if (data?.uris?.length) {
        walkDirCache.invalidate();
        void refreshIfNotIgnored(data.uris);
      }
    });

    on("files/closed", async ({ data }) => {
      if (data.uris) {
        this.messenger.send("didCloseFiles", {
          uris: data.uris,
        });
      }
    });

    on("files/opened", async ({ data }) => {
      if (data?.uris?.length) {
        // Do something on files opened
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
        // this.docsService.setPaused(msg.data.id, msg.data.paused); // not supported yet
      }
    });
    on("docs/initStatuses", async (msg) => {
      void this.docsService.initStatuses();
    });
    on("docs/getDetails", async (msg) => {
      return await this.docsService.getDetails(msg.data.startUrl);
    });
    //

    on("didChangeSelectedProfile", async (msg) => {
      await this.configHandler.setSelectedProfile(msg.data.id);
      await this.configHandler.reloadConfig();
    });

    on("didChangeSelectedOrg", async (msg) => {
      await this.configHandler.setSelectedOrgId(msg.data.id);
      await this.configHandler.loadAssistantsForSelectedOrg();
      if (msg.data.profileId) {
        this.invoke("didChangeSelectedProfile", {
          id: msg.data.profileId,
        });
      } else {
        await this.configHandler.reloadConfig();
      }
    });

    on("didChangeControlPlaneSessionInfo", async (msg) => {
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

    on("didChangeActiveTextEditor", async ({ data: { filepath } }) => {
      try {
        const ignore = shouldIgnore(filepath, this.ide);
        if (!ignore) {
          recentlyEditedFilesCache.set(filepath, filepath);
        }
      } catch (e) {
        console.error(
          `didChangeActiveTextEditor: failed to update recentlyEditedFiles cache for ${filepath}`,
        );
      }
    });

    on("tools/call", async (msg) => {
      const { toolCall, selectedModelTitle } = msg.data;
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

      const llm = await this.configHandler.llmFromTitle(selectedModelTitle);

      const contextItems = await callTool(
        tool,
        JSON.parse(toolCall.function.arguments || "{}"),
        {
          ide: this.ide,
          llm,
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
          tool,
        },
      );

      if (tool.faviconUrl) {
        contextItems.forEach((item) => {
          item.icon = tool.faviconUrl;
        });
      }

      return { contextItems };
    });
  }

  private indexingCancellationController: AbortController | undefined;
  private async sendIndexingErrorTelemetry(update: IndexingProgressUpdate) {
    console.debug(
      "Indexing failed with error: ",
      update.desc,
      update.debugInfo,
    );
    void Telemetry.capture(
      "indexing_error",
      {
        error: update.desc,
        stack: update.debugInfo,
      },
      false,
    );
  }

  private async refreshCodebaseIndex(paths: string[]) {
    if (this.indexingCancellationController) {
      this.indexingCancellationController.abort();
    }
    this.indexingCancellationController = new AbortController();
    for await (const update of (await this.codebaseIndexerPromise).refreshDirs(
      paths,
      this.indexingCancellationController.signal,
    )) {
      let updateToSend = { ...update };
      // TODO reconsider this status overwrite?
      // original goal was to not concern users with edge noncritical errors
      if (update.status === "failed") {
        updateToSend.status = "done";
        updateToSend.desc = "Indexing complete";
        updateToSend.progress = 1.0;
      }

      void this.messenger.request("indexProgress", updateToSend);
      this.codebaseIndexingState = updateToSend;

      if (update.status === "failed") {
        void this.sendIndexingErrorTelemetry(update);
      }
    }

    this.messenger.send("refreshSubmenuItems", {
      providers: "dependsOnIndexing",
    });
    this.indexingCancellationController = undefined;
  }

  private async refreshCodebaseIndexFiles(files: string[]) {
    // Can be cancelled by codebase index but not vice versa
    if (
      this.indexingCancellationController &&
      !this.indexingCancellationController.signal.aborted
    ) {
      return;
    }
    this.indexingCancellationController = new AbortController();
    for await (const update of (await this.codebaseIndexerPromise).refreshFiles(
      files,
    )) {
      let updateToSend = { ...update };
      if (update.status === "failed") {
        updateToSend.status = "done";
        updateToSend.desc = "Indexing complete";
        updateToSend.progress = 1.0;
      }

      void this.messenger.request("indexProgress", updateToSend);
      this.codebaseIndexingState = updateToSend;

      if (update.status === "failed") {
        void this.sendIndexingErrorTelemetry(update);
      }
    }

    this.messenger.send("refreshSubmenuItems", {
      providers: "dependsOnIndexing",
    });
    this.indexingCancellationController = undefined;
  }

  // private
}
