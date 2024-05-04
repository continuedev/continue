import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";
import configs from "../../indexing/docs/preIndexedDocs";
import TransformersJsEmbeddingsProvider from "../../indexing/embeddings/TransformersJsEmbeddingsProvider";

class DocsContextProvider extends BaseContextProvider {
  static DEFAULT_N_RETRIEVE = 30;
  static DEFAULT_N_FINAL = 15;
  static description: ContextProviderDescription = {
    title: "docs",
    displayTitle: "Docs",
    description: "Type to search docs",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { retrieveDocs } = await import("../../indexing/docs/db");

    const embeddingsProvider = new TransformersJsEmbeddingsProvider();
    const [vector] = await embeddingsProvider.embed([extras.fullInput]);

    let chunks = await retrieveDocs(
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
    const { listDocs } = await import("../../indexing/docs/db");
    const docs = await listDocs();
    const submenuItems = docs.map((doc) => ({
      title: doc.title,
      description: new URL(doc.baseUrl).hostname,
      id: doc.baseUrl,
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
        })),
    );
    return submenuItems;
  }
}

export default DocsContextProvider;
