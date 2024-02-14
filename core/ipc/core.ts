import { v4 as uuidv4 } from "uuid";
import { ContextItemId, IDE } from "..";
import { ConfigHandler } from "../config/handler";
import { addModel, addOpenAIKey, deleteModel } from "../config/util";
import { indexDocs } from "../indexing/docs";
import TransformersJsEmbeddingsProvider from "../indexing/embeddings/TransformersJsEmbeddingsProvider";
import { CodebaseIndexer } from "../indexing/indexCodebase";
import { logDevData } from "../util/devdata";
import historyManager from "../util/history";
import { Messenger, Protocol } from "./messenger";

export class Core {
  private messenger: Messenger;
  private readonly ide: IDE;
  private readonly configHandler: ConfigHandler;
  private readonly codebaseIndexer: CodebaseIndexer;

  private selectedModelTitle: string | undefined;

  private async config() {
    return this.configHandler.loadConfig();
  }

  private async getSelectedModel() {
    return await this.configHandler.llmFromTitle(this.selectedModelTitle);
  }

  constructor(messenger: Messenger, ide: IDE) {
    this.messenger = messenger;
    this.ide = ide;
    this.configHandler = new ConfigHandler(this.ide);
    this.codebaseIndexer = new CodebaseIndexer(this.configHandler, this.ide);

    const on = this.messenger.on;

    // New
    on("update/modelChange", (msg) => {
      this.selectedModelTitle = msg.data;
    });

    // History
    on("history/list", (msg) => {
      return historyManager.list();
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
    on("config/reload", (msg) => {});

    // Context providers
    on("context/addDocs", async (msg) => {
      for await (const _ of indexDocs(
        msg.data.title,
        new URL(msg.data.url),
        new TransformersJsEmbeddingsProvider()
      )) {
      }
    });
    on("context/loadSubmenuItems", async (msg) => {
      const config = await this.config();
      const items = config.contextProviders
        ?.find((provider) => provider.description.title === msg.data.title)
        ?.loadSubmenuItems({ ide: this.ide });
      return items || [];
    });
    on("context/getContextItems", async (msg) => {
      const config = await this.config();
      const llm = await this.getSelectedModel();
      const provider = config.contextProviders?.find(
        (provider) => provider.description.title === msg.data.name
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
      });
      return items;
    });
  }

  public invoke<T extends keyof Protocol>(
    method: keyof Protocol,
    data: Protocol[T][0]
  ): Protocol[T][1] {
    const response = this.messenger.invoke(method, data);
    return response;
  }
}

/**
 * configHandler should be in core? Probably everything should be in core?
 * - get rc files (define in IpcIde)
 * - override anonymous telemetry (telemetryAllowed)
 * - send config to browser whenever it loads (triggers come from IDE so that should happen there)
 * - access to a "readFile" function (ide.readFile)
 */
