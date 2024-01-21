import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";
import { getIndexSqlitePath } from "../../util/paths";

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
    const { open } = await import("sqlite");
    const sqlite3 = await import("sqlite3");
    // Load from SQLite, or shared registry
    const db = await open({
      filename: getIndexSqlitePath(),
      driver: sqlite3.Database,
    });
    return [];
  }
}

export default DocsContextProvider;
