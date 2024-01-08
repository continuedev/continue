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
    displayTitle: "Codebase Embeddings",
    description: "Use embeddings to automatically find relevant files",
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
    const [v] = await extras.embeddingsProvider.embed([extras.fullInput]);
    const results = await new ExtensionIde().retrieveChunks(v, 10, []);

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
