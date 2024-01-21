import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";

class DocsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "docs",
    displayTitle: "Docs",
    description: "Search documentation",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    return [];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]> {
    const { listDocs } = await import("../../indexing/docs/db");
    const docs = await listDocs();
    return docs.map((doc) => ({
      title: doc.title,
      description: new URL(doc.baseUrl).hostname,
      id: doc.baseUrl,
    }));
  }
}

export default DocsContextProvider;
