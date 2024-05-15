import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex.js";
import { BaseContextProvider } from "../index.js";

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
    return [
      await CodeSnippetsCodebaseIndex.getForId(Number.parseInt(query, 10)),
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const tags = await args.ide.getTags("codeSnippets");
    const snippets = await Promise.all(
      tags.map((tag) => CodeSnippetsCodebaseIndex.getAll(tag)),
    );

    const submenuItems: ContextSubmenuItem[] = [];
    for (const snippetList of snippets) {
      submenuItems.push(...snippetList);
    }

    return submenuItems;
  }
}

export default CodeContextProvider;
