import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { DocsService } from "../../indexing/docs/DocsService.js";
import preIndexedDocs from "../../indexing/docs/preIndexedDocs.js";
import TransformersJsEmbeddingsProvider from "../../indexing/embeddings/TransformersJsEmbeddingsProvider.js";
import { Telemetry } from "../../util/posthog.js";
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

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    this._logProviderName();

    const isPreIndexedDoc = !!preIndexedDocs[query];

    if (isPreIndexedDoc) {
      Telemetry.capture("docs_pre_indexed_doc_used", {
        doc: query,
      });
    }

    const embeddingsProvider = isPreIndexedDoc
      ? new TransformersJsEmbeddingsProvider()
      : extras.embeddingsProvider;

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

  private _sortByPreIndexedDocs(
    submenuItems: ContextSubmenuItem[],
  ): ContextSubmenuItem[] {
    // Sort submenuItems such that the objects with titles which don't occur in configs occur first, and alphabetized
    return submenuItems.sort((a, b) => {
      const aTitleInConfigs = a.metadata?.preIndexed ?? false;
      const bTitleInConfigs = b.metadata?.preIndexed ?? false;

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
  }

  /**
   * Currently, we generate and host embeddings for pre-indexed docs using Transformers.js
   * However, we don't ship Transformers.js with the JetBrains extension.
   *
   * This method has logic to avoid showing the pre-indexed docs to users to
   * avoid this conflict.
   */
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const ideInfo = await args.ide.getIdeInfo();
    const isJetBrains = ideInfo.ideType !== "jetbrains";
    const configSites = this.options?.sites || [];
    const submenuItemsMap = new Map<string, ContextSubmenuItem>();

    if (!isJetBrains) {
      for (const { startUrl, title } of Object.values(preIndexedDocs)) {
        submenuItemsMap.set(startUrl, {
          title,
          id: startUrl,
          description: new URL(startUrl).hostname,
          metadata: {
            preIndexed: true,
          },
        });
      }
    }

    for (const { title, baseUrl } of await this.docsService.list()) {
      submenuItemsMap.set(baseUrl, {
        title,
        id: baseUrl,
        description: new URL(baseUrl).hostname,
      });
    }

    for (const { startUrl, title } of configSites) {
      submenuItemsMap.set(startUrl, {
        title,
        id: startUrl,
        description: new URL(startUrl).hostname,
      });
    }

    const submenuItems = Array.from(submenuItemsMap.values());

    if (!isJetBrains) {
      return this._sortByPreIndexedDocs(submenuItems);
    }

    return submenuItems;
  }
}

export default DocsContextProvider;
