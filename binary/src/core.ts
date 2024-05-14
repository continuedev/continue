import { ContextItemId, IDE } from "core";
import { CompletionProvider } from "core/autocomplete/completionProvider";
import { ConfigHandler } from "core/config/handler";
import { addModel, addOpenAIKey, deleteModel } from "core/config/util";
import { indexDocs } from "core/indexing/docs";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { CodebaseIndexer, PauseToken } from "core/indexing/indexCodebase";
import { logDevData } from "core/util/devdata";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import historyManager from "core/util/history";
import { Message } from "core/util/messenger";
import { Telemetry } from "core/util/posthog";
import { streamDiffLines } from "core/util/verticalEdit";
import { v4 as uuidv4 } from "uuid";
import { IpcMessenger } from "./messenger";
import { Protocol } from "./protocol";

export class Core {
  private messenger: IpcMessenger;
  private readonly ide: IDE;
  private readonly configHandler: ConfigHandler;
  private readonly codebaseIndexer: CodebaseIndexer;
  private readonly completionProvider: CompletionProvider;

  private abortedMessageIds: Set<string> = new Set();

  private selectedModelTitle: string | undefined;

  private async config() {
    return this.configHandler.loadConfig();
  }

  private async getSelectedModel() {
    return await this.configHandler.llmFromTitle(this.selectedModelTitle);
  }

  constructor(messenger: IpcMessenger, ide: IDE) {
    this.messenger = messenger;
    this.ide = ide;

    const ideSettingsPromise = messenger.request("getIdeSettings", undefined);
    this.configHandler = new ConfigHandler(
      this.ide,
      ideSettingsPromise,
      async (text: string) => {},
      (() => this.messenger.send("configUpdate", undefined)).bind(this),
    );
    this.codebaseIndexer = new CodebaseIndexer(
      this.configHandler,
      this.ide,
      new PauseToken(false),
      undefined, // TODO
      Promise.resolve(undefined), // TODO
    );

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
      addModel(msg.data.model);
    });
    on("config/addOpenAiKey", (msg) => {
      addOpenAIKey(msg.data);
    });
    on("config/deleteModel", (msg) => {
      deleteModel(msg.data.title);
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
      const config = await this.config();
      const llm = await this.getSelectedModel();
      const provider = config.contextProviders?.find(
        (provider) => provider.description.title === msg.data.name,
      );
      if (!provider) return [];

      const id: ContextItemId = {
        providerTitle: provider.description.title,
        itemId: uuidv4(),
      };
      const items = await provider.getContextItems(msg.data.query, {
        llm,
        embeddingsProvider: config.embeddingsProvider,
        fullInput: msg.data.fullInput,
        ide,
        selectedCode: msg.data.selectedCode,
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
    });

    on("config/getBrowserSerialized", (msg) => {
      return this.configHandler.getSerializedConfig();
    });

    async function* llmStreamChat(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<Protocol["llm/streamChat"][0]>,
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

      msg: Message<Protocol["llm/streamComplete"][0]>,
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

    async function* runNodeJsSlashCommand(
      configHandler: ConfigHandler,
      abortedMessageIds: Set<string>,
      msg: Message<Protocol["command/run"][0]>,
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
      msg: Message<Protocol["streamDiffLines"][0]>,
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
  }

  public invoke<T extends keyof Protocol>(
    method: keyof Protocol,
    data: Protocol[T][0],
  ): Protocol[T][1] {
    const response = this.messenger.invoke(method, data);
    return response;
  }
}
