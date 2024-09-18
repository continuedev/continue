import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { retrieveContextItemsFromEmbeddings } from "../retrieval/retrieval.js";
import FileTreeContextProvider from "./FileTreeContextProvider";

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
   
    const embeddingsItems = await retrieveContextItemsFromEmbeddings(extras, this.options, undefined); 
    const fileTreeProvider = new FileTreeContextProvider(this.options);
    const directoryStructureItems = await fileTreeProvider.getContextItems(query, extras);

    return [...embeddingsItems, ...directoryStructureItems];
  }
  async load(): Promise<void> {}
}

export default CodebaseContextProvider;
