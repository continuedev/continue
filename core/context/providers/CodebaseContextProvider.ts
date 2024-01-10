import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { ExtensionIde } from "../../ide";
import { getBasename } from "../../util";

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    dynamic: false,
    requiresQuery: false,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    if (!extras.embeddingsProvider) {
      return [];
    }

    const nRetrieve = this.options.nRetrieve || 20;
    const nFinal = this.options.nFinal || 5;
    const useReranking = false;
    // this.options.useReranking === undefined
    //   ? true
    // : this.options.useReranking;

    // Similarity search
    const [v] = await extras.embeddingsProvider.embed([extras.fullInput]);
    const results = await new ExtensionIde().retrieveChunks(
      v,
      this.options.useReranking === false ? nFinal : nRetrieve,
      []
    );

    // Re-ranking
    if (useReranking) {
      // TODO
    }

    return results.map((r) => {
      const name = `${getBasename(r.filepath)} (${r.startLine}-${r.endLine})`;
      const description = `${r.filepath} (${r.startLine}-${r.endLine})`;
      return {
        name,
        description,
        content: `\`\`\`${name}\n${r.content}\n\`\`\``,
      };
    });
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
