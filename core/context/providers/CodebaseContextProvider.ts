import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { ExtensionIde } from "../../ide";

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
    console.log(results, "RESULTS");
    return [];
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
