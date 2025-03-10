import { BaseContextProvider } from "../";
import {
  Chunk,
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  IDE,
  LoadSubmenuItemsArgs,
} from "../..";
import DocsService from "../../indexing/docs/DocsService";
import preIndexedDocs from "../../indexing/docs/preIndexedDocs";

import { INSTRUCTIONS_BASE_ITEM } from "./utils";

class DocsContextProvider extends BaseContextProvider {
  static nRetrieve = 30;
  static nFinal = 15;
  static description: ContextProviderDescription = {
    title: "docs",
    displayTitle: "Docs",
    description: "Type to search docs",
    type: "submenu",
    // Todo: consider a different renderInline so that when multiple docs are referenced in one message,
    // Or the doc has an odd name unrelated to the content
    // The name of the doc itself doesn't skew the embedding results
    renderInlineAs: "",
  };

  constructor(options: any) {
    super(options);
    const docsService = DocsService.getSingleton();
    docsService?.setGithubToken(this.options?.githubToken);
  }

  private async _rerankChunks(
    chunks: Chunk[],
    reranker: NonNullable<ContextProviderExtras["reranker"]>,
    fullInput: ContextProviderExtras["fullInput"],
    ide: IDE,
  ) {
    let chunksCopy = [...chunks];

    try {
      const scores = await reranker.rerank(fullInput, chunksCopy);

      chunksCopy.sort(
        (a, b) => scores[chunksCopy.indexOf(b)] - scores[chunksCopy.indexOf(a)],
      );

      chunksCopy = chunksCopy.splice(
        0,
        this.options?.nFinal ?? DocsContextProvider.nFinal,
      );
    } catch (e) {
      void ide.showToast("warning", `Failed to rerank retrieval results\n${e}`);

      chunksCopy = chunksCopy.splice(
        0,
        this.options?.nFinal ?? DocsContextProvider.nFinal,
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
    const nRetrieve = this.options?.nRetrieve ?? DocsContextProvider.nRetrieve;
    const useReranking = this.options?.useReranking ?? true;

    // Get docs service
    const docsService = DocsService.getSingleton();
    if (!docsService) {
      console.error(`${DocsService.name} has not been initialized`);
      return [];
    }
    await docsService.isInitialized;

    // Get chunks
    let chunks = await docsService.retrieveChunksFromQuery(
      extras.fullInput, // confusing: fullInput = the query, query = startUrl in this case
      query,
      nRetrieve,
    );
    if (!chunks?.length) {
      return [];
    }

    // We found chunks, so check if there's a favicon for the docs page
    const favicon = await docsService.getFavicon(query);

    // Rerank if there's a reranker
    if (useReranking && extras.reranker) {
      chunks = await this._rerankChunks(
        chunks,
        extras.reranker,
        extras.fullInput,
        extras.ide,
      );
    }

    return [
      ...chunks
        .map((chunk) => ({
          icon: favicon,
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
          uri: {
            type: "url" as const,
            value: chunk.filepath,
          },
        }))
        .reverse(),
      {
        ...INSTRUCTIONS_BASE_ITEM,
        content:
          "Use the above documentation to answer the following question. You should not reference " +
          "anything outside of what is shown, unless it is a commonly known concept. Reference URLs " +
          "whenever possible using markdown formatting. If there isn't enough information to answer " +
          "the question, suggest where the user might look to learn more.",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    // Get docs service
    const docsService = DocsService.getSingleton();
    if (!docsService) {
      console.error(`${DocsService.name} has not been initialized`);
      return [];
    }
    await docsService.isInitialized;

    // Create map of docs url -> submenu item
    const submenuItemsMap = new Map<string, ContextSubmenuItem>();

    // Add custom docs from config
    const docs = (await docsService.listMetadata()) ?? [];
    for (const { startUrl, title, favicon } of docs) {
      submenuItemsMap.set(startUrl, {
        title,
        id: startUrl,
        description: new URL(startUrl).hostname,
        icon: favicon,
      });
    }

    // Add pre-indexed docs if supported
    const canUsePreindexedDocs = await docsService.canUsePreindexedDocs();
    if (canUsePreindexedDocs) {
      for (const { startUrl, title } of Object.values(preIndexedDocs)) {
        // Skip if overridden in config
        if (docs.find((d) => d.startUrl === startUrl)) {
          continue;
        }
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

    // Create array and sort if pre-indexed is supported
    const submenuItems = Array.from(submenuItemsMap.values());
    if (canUsePreindexedDocs) {
      return this._sortByPreIndexedDocs(submenuItems);
    }

    return submenuItems;
  }
}

export default DocsContextProvider;
