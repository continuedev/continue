import { v4 as uuidv4 } from "uuid";
import type { ContextItemId, IDE, IndexingProgressUpdate } from ".";
import { CompletionProvider } from "./autocomplete/completionProvider";
import { ConfigHandler } from "./config/ConfigHandler";
import {
  setupApiKeysMode,
  setupFreeTrialMode,
  setupLocalAfterFreeTrial,
  setupLocalMode,
} from "./config/onboarding";
import { createNewPromptFile } from "./config/promptFile";
import { addModel, addOpenAIKey, deleteModel } from "./config/util";
import { recentlyEditedFilesCache } from "./context/retrieval/recentlyEditedFilesCache";
import { ContinueServerClient } from "./continueServer/stubs/client";
import { getAuthUrlForTokenPage } from "./control-plane/auth/index";
import { ControlPlaneClient } from "./control-plane/client";
import { CodebaseIndexer, PauseToken } from "./indexing/CodebaseIndexer";
import DocsService from "./indexing/docs/DocsService";
import Ollama from "./llm/llms/Ollama";
import type { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import { GlobalContext } from "./util/GlobalContext";
import { logDevData } from "./util/devdata";
import { DevDataSqliteDb } from "./util/devdataSqlite";
import { fetchwithRequestOptions } from "./util/fetchWithOptions";
import historyManager from "./util/history";
import type { IMessenger, Message } from "./util/messenger";
import { editConfigJson } from "./util/paths";
import { Telemetry } from "./util/posthog";
import { streamDiffLines } from "./util/verticalEdit";

export class Core {
  // implements IMessenger<ToCoreProtocol, FromCoreProtocol>
  configHandler: ConfigHandler;
  codebaseIndexerPromise: Promise<CodebaseIndexer>;
  completionProvider: CompletionProvider;
  continueServerClientPromise: Promise<ContinueServerClient>;
  indexingState: IndexingProgressUpdate;
  controlPlaneClient: ControlPlaneClient;
  private docsService: DocsService;
  private globalContext = new GlobalContext();

  private readonly indexingPauseToken = new PauseToken(
    this.globalContext.get("indexingPaused") === true,
  );

  private abortedMessageIds: Set<string> = new Set();

  private selectedModelTitle: string | undefined;

  private async config() {
    return this.configHandler.loadConfig();
  }

  private async getSelectedModel() {
    return await this.configHandler.llmFromTitle(this.selectedModelTitle);
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
    return this.messenger.send(messageType, data);
  }

  // TODO: It shouldn't actually need an IDE type, because this can happen
  // through the messenger (it does in the case of any non-VS Code IDEs already)
  constructor(
    private readonly messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly ide: IDE,
    private readonly onWrite: (text: string) => Promise<void> = async () => {},
  ) {
    this.indexingState = { status: "loading", desc: "loading", progress: 0 };

    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    const sessionInfoPromise = messenger.request("getControlPlaneSessionInfo", {
      silent: true,
    });

    this.controlPlaneClient = new ControlPlaneClient(sessionInfoPromise);

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

    this.configHandler.onConfigUpdate(
      (() => this.messenger.send("configUpdate", undefined)).bind(this),
    );

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

    ideSettingsPromise.then((ideSettings) => {
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
      this.ide.getWorkspaceDirs().then(async (dirs) => {
        // Respect pauseCodebaseIndexOnStart user settings
        if (ideSettings.pauseCodebaseIndexOnStart) {
          await this.messenger.request("indexProgress", {
            progress: 100,
            desc: "Initial Indexing Skipped",
            status: "paused",
          });
          return;
        }

        this.refreshCodebaseIndex(dirs);
      });
    });

    const getLlm = async () => {
      const config = await this.configHandler.loadConfig();
      const selected = this.globalContext.get("selectedTabAutocompleteModel");
      return (
        config.tabAutocompleteModels?.find(
          (model) => model.title === selected,
        ) ?? config.tabAutocompleteModels?.[0]
      );
    };
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      ide,
      getLlm,
      (e) => {},
      (..._) => Promise.resolve([]),
    );

    const on = this.messenger.on.bind(this.messenger);

    this.messenger.onError((err) => {
      console.error(err);
      Telemetry.capture("core_messenger_error", {
        message: err.message,
      });
      this.messenger.request("errorPopup", { message: err.message });
    });

    // New
    on("update/modelChange", (msg) => {
      this.selectedModelTitle = msg.data;
    });

    on("update/selectTabAutocompleteModel", async (msg) => {
      this.globalContext.update("selectedTabAutocompleteModel", msg.data);
      this.configHandler.reloadConfig();
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
      addModel(model);
      this.configHandler.reloadConfig();
    });

    on("config/addOpenAiKey", (msg) => {
      addOpenAIKey(msg.data);
      this.configHandler.reloadConfig();
    });

    on("config/deleteModel", (msg) => {
      deleteModel(msg.data.title);
      this.configHandler.reloadConfig();
    });

    on("config/newPromptFile", async (msg) => {
      createNewPromptFile(
        this.ide,
        (await this.config()).experimental?.promptPath,
      );
      this.configHandler.reloadConfig();
    });

    on("config/reload", (msg) => {
      this.configHandler.reloadConfig();
      return this.configHandler.getSerializedConfig();
    });

    on("config/ideSettingsUpdate", (msg) => {
      this.configHandler.updateIdeSettings(msg.data);
    });
    on("config/listProfiles", (msg) => {
      return this.configHandler.listProfiles();
    });

    // Context providers
    on("context/addDocs", async (msg) => {
      let hasFailed = false;

      for await (const result of this.docsService.indexAndAdd(msg.data)) {
        if (result.status === "failed") {
          hasFailed = true;
          break;
        }
      }

      if (hasFailed) {
        this.ide.infoPopup(`Failed to index ${msg.data.startUrl}`);
      } else {
        this.ide.infoPopup(`Successfully indexed ${msg.data.startUrl}`);
        this.messenger.send("refreshSubmenuItems", undefined);
      }
    });

    on("context/removeDocs", async (msg) => {
      await this.docsService.delete(msg.data.startUrl);
      this.messenger.send("refreshSubmenuItems", undefined);
    });

    on("context/indexDocs", async (msg) => {
      await this.docsService.indexAllDocs(msg.data.reIndex);
      this.messenger.send("refreshSubmenuItems", undefined);
    });

    on("context/loadSubmenuItems", async (msg) => {
      const config = await this.config();
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
      const { name, query, fullInput, selectedCode } = msg.data;
      const config = await this.config();
      const llm = await this.getSelectedModel();
      const provider = config.contextProviders?.find(
        (provider) => provider.description.title === name,
      );
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

        Telemetry.capture(
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
        this.ide.errorPopup(`Error getting context items from ${name}: ${e}`);
        return [];
      }
    });

    on("config/getSerializedProfileInfo", async (msg) => {
      return {
        config: await this.configHandler.getSerializedConfig(),
        profileId: this.configHandler.currentProfile.profileId,
      };
    });

    async function* llmStreamChat(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["llm/streamChat"][0]>,
    ) {
      const model = await configHandler.llmFromTitle(msg.data.title);
      const gen = model.streamChat(
        msg.data.messages,
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
        yield { content: next.value.content };
        next = await gen.next();
      }

      return { done: true, content: next.value };
    }

    on("llm/streamChat", (msg) =>
      llmStreamChat(this.configHandler, this.abortedMessageIds, msg),
    );

    async function* llmStreamComplete(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,

      msg: Message<ToCoreProtocol["llm/streamComplete"][0]>,
    ) {
      const model = await configHandler.llmFromTitle(msg.data.title);
      const gen = model.streamComplete(
        msg.data.prompt,
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
        yield { content: next.value };
        next = await gen.next();
      }

      return { done: true, content: next.value };
    }

    on("llm/streamComplete", (msg) =>
      llmStreamComplete(this.configHandler, this.abortedMessageIds, msg),
    );

    on("llm/complete", async (msg) => {
      const model = await this.configHandler.llmFromTitle(msg.data.title);
      const completion = await model.complete(
        msg.data.prompt,
        msg.data.completionOptions,
      );
      return completion;
    });
    on("llm/listModels", async (msg) => {
      const config = await this.configHandler.loadConfig();
      const model =
        config.models.find((model) => model.title === msg.data.title) ??
        config.models.find((model) => model.title?.startsWith(msg.data.title));
      try {
        if (model) {
          return model.listModels();
        } else {
          if (msg.data.title === "Ollama") {
            const models = await new Ollama({ model: "" }).listModels();
            return models;
          } else {
            return undefined;
          }
        }
      } catch (e) {
        console.warn(`Error listing Ollama models: ${e}`);
        return undefined;
      }
    });

    async function* runNodeJsSlashCommand(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["command/run"][0]>,
      messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    ) {
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

      const config = await configHandler.loadConfig();
      const llm = await configHandler.llmFromTitle(modelTitle);
      const slashCommand = config.slashCommands?.find(
        (sc) => sc.name === slashCommandName,
      );
      if (!slashCommand) {
        throw new Error(`Unknown slash command ${slashCommandName}`);
      }

      Telemetry.capture(
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

      for await (const content of slashCommand.run({
        input,
        history,
        llm,
        contextItems,
        params,
        ide,
        addContextItem: (item) => {
          messenger.request("addContextItem", {
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
          break;
        }
        if (content) {
          yield { content };
        }
      }
      clearInterval(checkActiveInterval);
      yield { done: true, content: "" };
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
    on("autocomplete/accept", async (msg) => {});
    on("autocomplete/cancel", async (msg) => {
      this.completionProvider.cancel();
    });

    async function* streamDiffLinesGenerator(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["streamDiffLines"][0]>,
    ) {
      const data = msg.data;
      const llm = await configHandler.llmFromTitle(msg.data.modelTitle);
      for await (const diffLine of streamDiffLines(
        data.prefix,
        data.highlighted,
        data.suffix,
        llm,
        data.input,
        data.language,
      )) {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          break;
        }
        console.log(diffLine);
        yield { content: diffLine };
      }

      return { done: true };
    }

    on("streamDiffLines", (msg) =>
      streamDiffLinesGenerator(this.configHandler, this.abortedMessageIds, msg),
    );

    on("completeOnboarding", (msg) => {
      const mode = msg.data.mode;

      Telemetry.capture("onboardingSelection", {
        mode,
      });

      if (mode === "custom") {
        return;
      }

      let editConfigJsonCallback: Parameters<typeof editConfigJson>[0];

      switch (mode) {
        case "local":
          editConfigJsonCallback = setupLocalMode;
          break;

        case "freeTrial":
          editConfigJsonCallback = setupFreeTrialMode;
          break;

        case "localAfterFreeTrial":
          editConfigJsonCallback = setupLocalAfterFreeTrial;
          break;

        case "apiKeys":
          editConfigJsonCallback = setupApiKeysMode;
          break;

        default:
          console.error(`Invalid mode: ${mode}`);
          editConfigJsonCallback = (config) => config;
      }

      editConfigJson(editConfigJsonCallback);

      this.configHandler.reloadConfig();
    });

    on("addAutocompleteModel", (msg) => {
      editConfigJson((config) => {
        return {
          ...config,
          tabAutocompleteModel: msg.data.model,
        };
      });
      this.configHandler.reloadConfig();
    });

    on("stats/getTokensPerDay", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerDay();
      return rows;
    });
    on("stats/getTokensPerModel", async (msg) => {
      const rows = await DevDataSqliteDb.getTokensPerModel();
      return rows;
    });
    on("index/forceReIndex", async (msg) => {
      const dirs = msg.data ? [msg.data] : await this.ide.getWorkspaceDirs();
      await this.refreshCodebaseIndex(dirs);
    });
    on("index/setPaused", (msg) => {
      new GlobalContext().update("indexingPaused", msg.data);
      this.indexingPauseToken.paused = msg.data;
    });
    on("index/indexingProgressBarInitialized", async (msg) => {
      // Triggered when progress bar is initialized.
      // If a non-default state has been stored, update the indexing display to that state
      if (this.indexingState.status !== "loading") {
        this.messenger.request("indexProgress", this.indexingState);
      }
    });

    on("didChangeSelectedProfile", (msg) => {
      this.configHandler.setSelectedProfile(msg.data.id);
      this.configHandler.reloadConfig();
    });
    on("didChangeControlPlaneSessionInfo", async (msg) => {
      this.configHandler.updateControlPlaneSessionInfo(msg.data.sessionInfo);
    });
    on("auth/getAuthUrl", async (msg) => {
      const url = await getAuthUrlForTokenPage();
      return { url };
    });

    on("didChangeActiveTextEditor", ({ data: { filepath } }) => {
      recentlyEditedFilesCache.set(filepath, filepath);
    });
  }

  private indexingCancellationController: AbortController | undefined;

  private async refreshCodebaseIndex(dirs: string[]) {
    if (this.indexingCancellationController) {
      this.indexingCancellationController.abort();
    }
    this.indexingCancellationController = new AbortController();
    for await (const update of (await this.codebaseIndexerPromise).refresh(
      dirs,
      this.indexingCancellationController.signal,
    )) {
      this.messenger.request("indexProgress", update);
      this.indexingState = update;
    }

    this.messenger.send("refreshSubmenuItems", undefined);
  }
}
