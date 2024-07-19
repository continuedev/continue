import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex.js";
import { BaseContextProvider } from "../index.js";

const MAX_SUBMENU_ITEMS = 10_000;

class CodeContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "code",
    displayTitle: "Code",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Assume the query is the id as returned by loadSubmenuItems
    console.log("getContextItems called with query:", query);
    return [
      await CodeSnippetsCodebaseIndex.getForId(Number.parseInt(query, 10)),
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    console.log("loadSubmenuItems called with args:", args);

    // TODO: Dynamically load submenu items based on the query
    // instead of loading everything into memory
    const tags = await args.ide.getTags("codeSnippets");
    console.log("Retrieved tags:", tags);

    const snippets = await Promise.all(
      tags.map((tag) => CodeSnippetsCodebaseIndex.getAll(tag)),
    );
    console.log("Retrieved snippets:", snippets);

    const submenuItems: ContextSubmenuItem[] = [];
    for (const snippetList of snippets.slice(-MAX_SUBMENU_ITEMS)) {
      submenuItems.push(...snippetList);
    }
    console.log("Generated submenuItems:", submenuItems);

    console.log(`Returning ${submenuItems.length} submenu items`);
    return submenuItems;
  }
}

export default CodeContextProvider;
