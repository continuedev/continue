import { v4 as uuidv4 } from "uuid";
import { ContextItemId, IDE } from ".";
import { CompletionProvider } from "./autocomplete/completionProvider";
import { ConfigHandler } from "./config/handler";
import {
  setupLocalMode,
  setupOptimizedExistingUserMode,
  setupOptimizedMode,
} from "./config/onboarding";
import { addModel, addOpenAIKey, deleteModel } from "./config/util";
import { ContinueServerClient } from "./continueServer/stubs/client";
import { indexDocs } from "./indexing/docs";
import TransformersJsEmbeddingsProvider from "./indexing/embeddings/TransformersJsEmbeddingsProvider";
import { CodebaseIndexer, PauseToken } from "./indexing/indexCodebase";
import { FromCoreProtocol, ToCoreProtocol } from "./protocol";
import { GlobalContext } from "./util/GlobalContext";
import { logDevData } from "./util/devdata";
import { DevDataSqliteDb } from "./util/devdataSqlite";
import { fetchwithRequestOptions } from "./util/fetchWithOptions";
import historyManager from "./util/history";
import type { IMessenger, Message } from "./util/messenger";
import { editConfigJson, getConfigJsonPath } from "./util/paths";
import { Telemetry } from "./util/posthog";
import { streamDiffLines } from "./util/verticalEdit";

export class Core {
  // implements IMessenger<ToCoreProtocol, FromCoreProtocol>
  configHandler: ConfigHandler;
  codebaseIndexerPromise: Promise<CodebaseIndexer>;
  completionProvider: CompletionProvider;
  continueServerClientPromise: Promise<ContinueServerClient>;

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

  // TODO: It shouldn't actually need an IDE type, because this can happen
  // through the messenger (it does in the case of any non-VS Code IDEs already)
  constructor(
    private readonly messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
    private readonly ide: IDE,
  ) {
    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    this.configHandler = new ConfigHandler(
      this.ide,
      ideSettingsPromise,
      async (text: string) => {},
      (() => this.messenger.send("configUpdate", undefined)).bind(this),
    );

    // Codebase Indexer and ContinueServerClient depend on IdeSettings
    const indexingPauseToken = new PauseToken(
      new GlobalContext().get("indexingPaused") === true,
    );
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
          new PauseToken(false),
          continueServerClient,
        ),
      );
      this.ide
        .getWorkspaceDirs()
        .then((dirs) => this.refreshCodebaseIndex(dirs));
    });

    const getLlm = async () => {
      const config = await this.configHandler.loadConfig();
      return config.tabAutocompleteModel;
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
      this.messenger.request("errorPopup", { message: err.message });
    });

    // New
    on("update/modelChange", (msg) => {
      this.selectedModelTitle = msg.data;
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
      const newConfigString = addModel(model);
      this.configHandler.reloadConfig();
      this.ide.openFile(getConfigJsonPath());

      // Find the range where it was added and highlight
      const lines = newConfigString.split("\n");
      let startLine: number | undefined;
      let endLine: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!startLine) {
          if (line.trim() === `"title": "${model.title}",`) {
            startLine = i - 1;
          }
        } else {
          if (line.startsWith("    }")) {
            endLine = i;
            break;
          }
        }
      }

      if (startLine && endLine) {
        this.ide.showLines(
          getConfigJsonPath(),
          startLine,
          endLine,
          // "#fff1"
        );
      }
    });
    on("config/addOpenAiKey", (msg) => {
      addOpenAIKey(msg.data);
      this.configHandler.reloadConfig();
    });
    on("config/deleteModel", (msg) => {
      deleteModel(msg.data.title);
      this.configHandler.reloadConfig();
    });
    on("config/reload", (msg) => {
      this.configHandler.reloadConfig();
      return this.configHandler.getSerializedConfig();
    });
    on("config/ideSettingsUpdate", (msg) => {
      this.configHandler.updateIdeSettings(msg.data);
    });

    // Context providers
    on("context/addDocs", async (msg) => {
      for await (const _ of indexDocs(
        msg.data.title,
        new URL(msg.data.url),
        new TransformersJsEmbeddingsProvider(),
      )) {
      }
      this.ide.infoPopup(`🎉 Successfully indexed ${msg.data.title}`);
      this.messenger.send("refreshSubmenuItems", undefined);
    });
    on("context/loadSubmenuItems", async (msg) => {
      const config = await this.config();
      const items = config.contextProviders
        ?.find((provider) => provider.description.title === msg.data.title)
        ?.loadSubmenuItems({
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
      if (!provider) return [];

      try {
        const id: ContextItemId = {
          providerTitle: provider.description.title,
          itemId: uuidv4(),
        };
        const items = await provider.getContextItems(query, {
          llm,
          embeddingsProvider: config.embeddingsProvider,
          fullInput,
          ide,
          selectedCode,
          reranker: config.reranker,
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
        });

        Telemetry.capture("useContextProvider", {
          name: provider.description.title,
        });

        return items.map((item) => ({
          ...item,
          id,
        }));
      } catch (e) {
        this.ide.errorPopup(`Error getting context items from ${name}: ${e}`);
        return [];
      }
    });

    on("config/getBrowserSerialized", (msg) => {
      return this.configHandler.getSerializedConfig();
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

    async function* runNodeJsSlashCommand(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<ToCoreProtocol["command/run"][0]>,
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

      Telemetry.capture("useSlashCommand", {
        name: slashCommandName,
      });

      for await (const content of slashCommand.run({
        input,
        history,
        llm,
        contextItems,
        params,
        ide,
        addContextItem: (item) => {
          // TODO
          // protocol.request("addContextItem", {
          //   item,
          //   historyIndex,
          // });
        },
        selectedCode,
        config,
        fetch: (url, init) =>
          fetchwithRequestOptions(url, init, config.requestOptions),
      })) {
        if (content) {
          yield { content };
        }
      }
      yield { done: true, content: "" };
    }
    on("command/run", (msg) =>
      runNodeJsSlashCommand(this.configHandler, this.abortedMessageIds, msg),
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
      if (mode === "custom" || mode === "localExistingUser") {
        return;
      }
      editConfigJson(
        mode === "local"
          ? setupLocalMode
          : mode === "optimized"
            ? setupOptimizedMode
            : setupOptimizedExistingUserMode,
      );
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
      this.refreshCodebaseIndex(dirs);
    });
    on("index/setPaused", (msg) => {
      new GlobalContext().update("indexingPaused", msg.data);
      indexingPauseToken.paused = msg.data;
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
    }
  }
}
