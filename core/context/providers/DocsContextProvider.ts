import {
  Chunk,
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  EmbeddingsProvider,
  LoadSubmenuItemsArgs,
  Reranker,
} from "../../index.js";
import { DocsService } from "../../indexing/docs/DocsService.js";
import preIndexedDocs from "../../indexing/docs/preIndexedDocs.js";
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

  private async _rerankChunks(
    chunks: Chunk[],
    reranker: NonNullable<ContextProviderExtras["reranker"]>,
    fullInput: ContextProviderExtras["fullInput"],
  ) {
    let chunksCopy = [...chunks];

    try {
      const scores = await reranker.rerank(fullInput, chunksCopy);

      chunksCopy.sort(
        (a, b) => scores[chunksCopy.indexOf(b)] - scores[chunksCopy.indexOf(a)],
      );

      chunksCopy = chunksCopy.splice(
        0,
        this.options?.nFinal ?? DocsContextProvider.DEFAULT_N_FINAL,
      );
    } catch (e) {
      console.warn(`Failed to rerank docs results: ${e}`);

      chunksCopy = chunksCopy.splice(
        0,
        this.options?.nFinal ?? DocsContextProvider.DEFAULT_N_FINAL,
      );
    }

    return chunksCopy;
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

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const ideInfo = await extras.ide.getIdeInfo();
    const isJetBrains = ideInfo.ideType === "jetbrains";

    const isJetBrainsAndPreIndexedDocsProvider =
      this.docsService.isJetBrainsAndPreIndexedDocsProvider(
        ideInfo,
        extras.embeddingsProvider.id,
      );

    if (isJetBrainsAndPreIndexedDocsProvider) {
      extras.ide.errorPopup(
        `${DocsService.preIndexedDocsEmbeddingsProvider.id} is configured as ` +
          "the embeddings provider, but it cannot be used with JetBrains. " +
          "Please select a different embeddings provider to use the '@docs' " +
          "context provider.",
      );

      return [];
    }

    const preIndexedDoc = preIndexedDocs[query];

    let embeddingsProvider: EmbeddingsProvider;

    if (!!preIndexedDoc && !isJetBrains) {
      // Pre-indexed docs should be filtered out in `loadSubmenuItems`,
      // for JetBrains users, but we sanity check that here
      Telemetry.capture("docs_pre_indexed_doc_used", {
        doc: preIndexedDoc["title"],
      });

      embeddingsProvider = DocsService.preIndexedDocsEmbeddingsProvider;
    } else {
      embeddingsProvider = extras.embeddingsProvider;
    }

    const [vector] = await embeddingsProvider.embed([extras.fullInput]);

    let chunks = await this.docsService.retrieve(
      query,
      vector,
      this.options?.nRetrieve ?? DocsContextProvider.DEFAULT_N_RETRIEVE,
      embeddingsProvider.id,
    );

    if (extras.reranker) {
      chunks = await this._rerankChunks(
        chunks,
        extras.reranker,
        extras.fullInput,
      );
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
          description: chunk.filepath,
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
    const ideInfo = await args.ide.getIdeInfo();
    const isJetBrains = ideInfo.ideType === "jetbrains";
    const configSites = this.options?.sites || [];
    const submenuItemsMap = new Map<string, ContextSubmenuItem>();

    if (!isJetBrains) {
      // Currently, we generate and host embeddings for pre-indexed docs using transformers.js.
      // However, we don't ship transformers.js with the JetBrains extension.
      // So, we only include pre-indexed docs in the submenu for non-JetBrains IDEs.
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
