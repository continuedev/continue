import path from "path";

import { fetchwithRequestOptions } from "@continuedev/fetch";
import ignore from "ignore";
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
import { addContextProvider, addModel, deleteModel } from "./config/util";
import { recentlyEditedFilesCache } from "./context/retrieval/recentlyEditedFilesCache";
import { ContinueServerClient } from "./continueServer/stubs/client";
import { getAuthUrlForTokenPage } from "./control-plane/auth/index";
import { ControlPlaneClient } from "./control-plane/client";
import { getControlPlaneEnv } from "./control-plane/env";
import { streamDiffLines } from "./edit/streamDiffLines";
import { CodebaseIndexer, PauseToken } from "./indexing/CodebaseIndexer";
import DocsService from "./indexing/docs/DocsService";
import { getAllSuggestedDocs } from "./indexing/docs/suggestions";
import { defaultIgnoreFile } from "./indexing/ignore.js";
import Ollama from "./llm/llms/Ollama";
import { createNewPromptFileV2 } from "./promptFiles/v2/createNewPromptFile";
import { callTool } from "./tools/callTool";
import { ChatDescriber } from "./util/chatDescriber";
import { clipboardCache } from "./util/clipboardCache";
import { logDevData } from "./util/devdata";
import { DevDataSqliteDb } from "./util/devdataSqlite";
import { GlobalContext } from "./util/GlobalContext";
import historyManager from "./util/history";
import {
  editConfigJson,
  getConfigJsonPath,
  setupInitialDotContinueDirectory,
} from "./util/paths";
import { localPathToUri } from "./util/pathToUri";
import { Telemetry } from "./util/posthog";
import { getSymbolsForManyFiles } from "./util/treeSitter";
import { TTS } from "./util/tts";

import {
  ChatMessage,
  DiffLine,
  PromptLog,
  type ContextItemId,
  type IDE,
  type IndexingProgressUpdate,
} from ".";

import CodebaseContextProvider from "./context/providers/CodebaseContextProvider";
import CurrentFileContextProvider from "./context/providers/CurrentFileContextProvider";
import type { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import type { IMessenger, Message } from "./protocol/messenger";

export class Core {
  configHandler: ConfigHandler;
  codebaseIndexerPromise: Promise<CodebaseIndexer>;
  completionProvider: CompletionProvider;
  continueServerClientPromise: Promise<ContinueServerClient>;
  codebaseIndexingState: IndexingProgressUpdate;
  controlPlaneClient: ControlPlaneClient;
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
    setupInitialDotContinueDirectory();

    this.codebaseIndexingState = {
      status: "loading",
      desc: "loading",
      progress: 0,
    };

    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    const sessionInfoPromise = messenger.request("getControlPlaneSessionInfo", {
      silent: true,
      useOnboarding: false,
    });

    this.controlPlaneClient = new ControlPlaneClient(
      sessionInfoPromise,
      ideSettingsPromise,
    );

    this.configHandler = new ConfigHandler(
      this.ide,
      ideSettingsPromise,
      this.onWrite,
      this.controlPlaneClient,
    );

    this.docsService = DocsService.createSingleton(
      this.configHandler,
      this.ide,
      this.messenger,
    );

    this.configHandler.onConfigUpdate(async (result) => {
      const serializedResult = await this.configHandler.getSerializedConfig();
      this.messenger.send("configUpdate", {
        result: serializedResult,
        profileId:
          this.configHandler.currentProfile?.profileDescription.id ?? null,
      });
    });

    this.configHandler.onDidChangeAvailableProfiles((profiles) =>
      this.messenger.send("didChangeAvailableProfiles", { profiles }),
    );

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
    on("devdata/log", (msg) => {
      logDevData(msg.data.tableName, msg.data.data);
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

    on("config/listProfiles", (msg) => {
      return this.configHandler.listProfiles();
    });

    on("config/addContextProvider", async (msg) => {
      addContextProvider(msg.data, this.configHandler);
    });

    on("config/updateSharedConfig", async (msg) => {
      const newSharedConfig = this.globalContext.updateSharedConfig(msg.data);
      await this.configHandler.reloadConfig();
      return newSharedConfig;
    });

    on("config/updateSelectedModel", async (msg) => {
      const newSharedConfig = this.globalContext.updateSelectedModel(
        msg.data.role,
        msg.data.title,
      );
      await this.configHandler.reloadConfig();
      return newSharedConfig;
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
      return await this.controlPlaneClient.listOrganizations();
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
          embeddingsProvider: config.embeddingsProvider,
          fullInput,
          ide,
          selectedCode,
          reranker: config.reranker,
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
          // A specific error where we're forcing the presence of embeddings provider on the config
          // But Jetbrains doesn't support transformers JS
          // So if a context provider needs it it will throw this error when the file isn't found
          if (e.message.includes("all-MiniLM-L6-v2")) {
            knownError = true;
            const toastOption = "See Docs";
            void this.ide
              .showToast(
                "error",
                `Set up an embeddings model to use @${name}`,
                toastOption,
              )
              .then((userSelection) => {
                if (userSelection === toastOption) {
                  void this.ide.openUrl(
                    "https://docs.continue.dev/customize/model-types/embeddings",
                  );
                }
              });
          }
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

    async function* llmStreamChat(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["llm/streamChat"][0]>,
    ): AsyncGenerator<ChatMessage, PromptLog> {
      const { config } = await configHandler.loadConfig();
      if (!config) {
        throw new Error("Config not loaded");
      }

      // Stop TTS on new StreamChat
      if (config.experimental?.readResponseTTS) {
        void TTS.kill();
      }

      const model = await configHandler.llmFromTitle(msg.data.title);

      const gen = model.streamChat(
        msg.data.messages,
        new AbortController().signal,
        msg.data.completionOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          next = await gen.return({
            modelTitle: model.title ?? model.model,
            completion: "",
            prompt: "",
            completionOptions: {
              ...msg.data.completionOptions,
              model: model.model,
            },
          });
          break;
        }

        const chunk = next.value;

        yield chunk;
        next = await gen.next();
      }

      if (config.experimental?.readResponseTTS && "completion" in next.value) {
        void TTS.read(next.value?.completion);
      }

      void Telemetry.capture(
        "chat",
        {
          model: model.model,
          provider: model.providerName,
        },
        true,
      );

      if (!next.done) {
        throw new Error("Will never happen");
      }

      return next.value;
    }

    on("llm/streamChat", (msg) =>
      llmStreamChat(this.configHandler, this.abortedMessageIds, msg),
    );

    async function* llmStreamComplete(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["llm/streamComplete"][0]>,
    ): AsyncGenerator<string, PromptLog> {
      const model = await configHandler.llmFromTitle(msg.data.title);
      const gen = model.streamComplete(
        msg.data.prompt,
        new AbortController().signal,
        msg.data.completionOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          next = await gen.return({
            modelTitle: model.title ?? model.model,
            completion: "",
            prompt: "",
            completionOptions: {
              ...msg.data.completionOptions,
              model: model.model,
            },
          });
          break;
        }
        yield next.value;
        next = await gen.next();
      }
      if (!next.done) {
        throw new Error("This will never happen");
      }
      return next.value;
    }

    on("llm/streamComplete", (msg) =>
      llmStreamComplete(this.configHandler, this.abortedMessageIds, msg),
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

    async function* runNodeJsSlashCommand(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["command/run"][0]>,
      messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    ): AsyncGenerator<string> {
      const {
        input,
        history,
        modelTitle,
        slashCommandName,
        contextItems,
        params,
        historyIndex,
        selectedCode,
      } = msg.data;

      const { config } = await configHandler.loadConfig();
      if (!config) {
        throw new Error("Config not loaded");
      }

      const llm = await configHandler.llmFromTitle(modelTitle);
      const slashCommand = config.slashCommands?.find(
        (sc) => sc.name === slashCommandName,
      );
      if (!slashCommand) {
        throw new Error(`Unknown slash command ${slashCommandName}`);
      }

      void Telemetry.capture(
        "useSlashCommand",
        {
          name: slashCommandName,
        },
        true,
      );

      const checkActiveInterval = setInterval(() => {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          clearInterval(checkActiveInterval);
        }
      }, 100);

      try {
        for await (const content of slashCommand.run({
          input,
          history,
          llm,
          contextItems,
          params,
          ide,
          addContextItem: (item) => {
            void messenger.request("addContextItem", {
              item,
              historyIndex,
            });
          },
          selectedCode,
          config,
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
        })) {
          if (abortedMessageIds.has(msg.messageId)) {
            abortedMessageIds.delete(msg.messageId);
            clearInterval(checkActiveInterval);
            break;
          }
          if (content) {
            yield content;
          }
        }
      } catch (e) {
        throw e;
      } finally {
        clearInterval(checkActiveInterval);
      }
    }
    on("command/run", (msg) =>
      runNodeJsSlashCommand(
        this.configHandler,
        this.abortedMessageIds,
        msg,
        this.messenger,
      ),
    );

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

      let editConfigJsonCallback: Parameters<typeof editConfigJson>[0];

      switch (mode) {
        case "Local":
          editConfigJsonCallback = setupLocalConfig;
          break;

        case "Quickstart":
          editConfigJsonCallback = setupQuickstartConfig;
          break;

        case "Best":
          editConfigJsonCallback = setupBestConfig;
          break;

        default:
          console.error(`Invalid mode: ${mode}`);
          editConfigJsonCallback = (config) => config;
      }

      editConfigJson(editConfigJsonCallback);

      void this.configHandler.reloadConfig();
    });

    on("addAutocompleteModel", (msg) => {
      editConfigJson((config) => {
        return {
          ...config,
          tabAutocompleteModel: msg.data.model,
        };
      });
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
        for (const uri of data.uris) {
          // Listen for file changes in the workspace
          // URI TODO is this equality statement valid?
          if (URI.equal(uri, localPathToUri(getConfigJsonPath()))) {
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
            this.invoke("index/forceReIndex", undefined);
          } else {
            // Reindex the file
            await this.refreshCodebaseIndexFiles([uri]);
          }
        }
      }
    });

    on("files/created", async ({ data }) => {
      if (data?.uris?.length) {
        this.messenger.send("refreshSubmenuItems", {
          providers: ["file"],
        });
        await this.refreshCodebaseIndexFiles(data.uris);
      }
    });

    on("files/deleted", async ({ data }) => {
      if (data?.uris?.length) {
        this.messenger.send("refreshSubmenuItems", {
          providers: ["file"],
        });
        await this.refreshCodebaseIndexFiles(data.uris);
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
    on("docs/getSuggestedDocs", async (msg) => {
      if (hasRequestedDocs) {
        return;
      } // TODO, remove, hack because of rerendering
      hasRequestedDocs = true;
      const suggestedDocs = await getAllSuggestedDocs(this.ide);
      this.messenger.send("docs/suggestions", suggestedDocs);
    });
    on("docs/initStatuses", async (msg) => {
      void this.docsService.initStatuses();
    });
    on("docs/getDetails", async (msg) => {
      return await this.docsService.getDetails(msg.data.startUrl);
    });
    //

    on("didChangeSelectedProfile", (msg) => {
      void this.configHandler.setSelectedProfile(msg.data.id);
      void this.configHandler.reloadConfig();
    });

    on("didChangeSelectedOrg", (msg) => {
      void this.configHandler.setSelectedOrgId(msg.data.id);
      void this.configHandler.reloadConfig();
      void this.configHandler.loadPlatformProfiles();
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
      const ignoreInstance = ignore().add(defaultIgnoreFile);
      let rootDirectory = await this.ide.getWorkspaceDirs();
      const relativeFilePath = path.relative(rootDirectory[0], filepath);
      try {
        if (!ignoreInstance.ignores(relativeFilePath)) {
          recentlyEditedFilesCache.set(filepath, filepath);
        }
      } catch (e) {
        if (e instanceof RangeError) {
          // do nothing, this can happen when editing a file outside the workspace such as `../extensions/.continue-debug/config.json`
        } else {
          console.debug("unhandled ignores error", relativeFilePath, e);
        }
      }
    });

    on("tools/call", async ({ data: { toolCall, selectedModelTitle } }) => {
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
  }

  // private
}

let hasRequestedDocs = false;
