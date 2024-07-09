import fetch from "node-fetch";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { DocsService } from "../../indexing/docs/DocsService.js";
import configs from "../../indexing/docs/preIndexedDocs.js";
import TransformersJsEmbeddingsProvider from "../../indexing/embeddings/TransformersJsEmbeddingsProvider.js";
import { BaseContextProvider } from "../index.js";

class DocsContextProvider extends BaseContextProvider {
  static DEFAULT_N_RETRIEVE = 30;
  static DEFAULT_N_FINAL = 15;
  static description: ContextProviderDescription = {
    title: "docs",
    displayTitle: "Docs",
    description: "Type to search docs",
    type: "submenu",
  };
  private docsService: DocsService;

  constructor(options: any) {
    super(options);
    this.docsService = DocsService.getInstance();
  }

  private async _getIconDataUrl(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url);
      if (!response.headers.get("content-type")?.startsWith("image/")) {
        console.log("Not an image: ", await response.text());
        return undefined;
      }
      const buffer = await response.buffer();
      const base64data = buffer.toString("base64");
      return `data:${response.headers.get("content-type")};base64,${base64data}`;
    } catch (e) {
      console.log("E: ", e);
      return undefined;
    }
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Not supported in JetBrains IDEs right now
    if ((await extras.ide.getIdeInfo()).ideType === "jetbrains") {
      throw new Error(
        "The @docs context provider is not currently supported in JetBrains IDEs. We'll have an update soon!",
      );
    }

    const embeddingsProvider = new TransformersJsEmbeddingsProvider();
    const [vector] = await embeddingsProvider.embed([extras.fullInput]);

    let chunks = await this.docsService.retrieve(
      query,
      vector,
      this.options?.nRetrieve ?? DocsContextProvider.DEFAULT_N_RETRIEVE,
      embeddingsProvider.id,
    );

    if (extras.reranker) {
      try {
        const scores = await extras.reranker.rerank(extras.fullInput, chunks);
        chunks.sort(
          (a, b) => scores[chunks.indexOf(b)] - scores[chunks.indexOf(a)],
        );
        chunks = chunks.splice(
          0,
          this.options?.nFinal ?? DocsContextProvider.DEFAULT_N_FINAL,
        );
      } catch (e) {
        console.warn(`Failed to rerank docs results: ${e}`);
        chunks = chunks.splice(
          0,
          this.options?.nFinal ?? DocsContextProvider.DEFAULT_N_FINAL,
        );
      }
    }

    return [
      ...chunks
        .map((chunk) => ({
          name: chunk.filepath.includes("/tree/main") // For display of GitHub files
            ? chunk.filepath
                .split("/")
                .slice(1)
                .join("/")
                .split("/tree/main/")
                .slice(1)
                .join("/")
            : chunk.otherMetadata?.title || chunk.filepath,
          description: chunk.filepath, // new URL(chunk.filepath, query).toString(),
          content: chunk.content,
        }))
        .reverse(),
      {
        name: "Instructions",
        description: "Instructions",
        content:
          "Use the above documentation to answer the following question. You should not reference anything outside of what is shown, unless it is a commonly known concept. Reference URLs whenever possible using markdown formatting. If there isn't enough information to answer the question, suggest where the user might look to learn more.",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const docs = await this.docsService.list();
    const submenuItems: ContextSubmenuItem[] = docs.map((doc) => ({
      title: doc.title,
      description: new URL(doc.baseUrl).hostname,
      id: doc.baseUrl,
      metadata: {
        preIndexed: !!configs.find((config) => config.title === doc.title),
      },
    }));

    submenuItems.push(
      ...configs
        // After it's actually downloaded, we don't want to show twice
        .filter(
          (config) => !submenuItems.some((item) => item.id === config.startUrl),
        )
        .map((config) => ({
          title: config.title,
          description: new URL(config.startUrl).hostname,
          id: config.startUrl,
          metadata: {
            preIndexed: true,
          },
          // iconUrl: config.faviconUrl,
        })),
    );

    // Sort submenuItems such that the objects with titles which don't occur in configs occur first, and alphabetized
    submenuItems.sort((a, b) => {
      const aTitleInConfigs = a.metadata?.preIndexed;
      const bTitleInConfigs = b.metadata?.preIndexed;

      // Primary criterion: Items not in configs come first
      if (!aTitleInConfigs && bTitleInConfigs) {
        return -1;
      } else if (aTitleInConfigs && !bTitleInConfigs) {
        return 1;
      } else {
        // Secondary criterion: Alphabetical order when both items are in the same category
        return a.title.toString().localeCompare(b.title.toString());
      }
    });

    // const icons = await Promise.all(
    //   submenuItems.map(async (item) =>
    //     item.iconUrl ? this._getIconDataUrl(item.iconUrl) : undefined,
    //   ),
    // );
    // icons.forEach((icon, i) => {
    //   submenuItems[i].iconUrl = icon;
    // });

    return submenuItems;
  }
}

export default DocsContextProvider;
