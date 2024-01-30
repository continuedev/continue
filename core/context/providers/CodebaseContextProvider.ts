import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const { retrieveContextItemsFromEmbeddings } = await import("../retrieval");
    return retrieveContextItemsFromEmbeddings(extras, this.options, undefined);
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
