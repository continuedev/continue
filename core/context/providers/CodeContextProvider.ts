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
    dependsOnIndexing: ["chunk", "codeSnippets"],
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Assume the query is the id as returned by loadSubmenuItems
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    return [
      await CodeSnippetsCodebaseIndex.getForId(
        Number.parseInt(query, 10),
        workspaceDirs,
      ),
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    // TODO: Dynamically load submenu items based on the query
    // instead of loading everything into memory
    const tags = await args.ide.getTags("codeSnippets");
    const snippets = await Promise.all(
      tags.map((tag) => CodeSnippetsCodebaseIndex.getAll(tag)),
    );

    const submenuItems: ContextSubmenuItem[] = [];

    for (const snippetList of snippets.slice(-MAX_SUBMENU_ITEMS)) {
      submenuItems.push(...snippetList);
    }

    return submenuItems;
  }
}

export default CodeContextProvider;
