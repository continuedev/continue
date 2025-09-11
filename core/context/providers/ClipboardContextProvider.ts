import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";
import { clipboardCache } from "../../util/clipboardCache";

const MAX_CLIPBOARD_ITEMS = 10;

class ClipboardContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "clipboard",
    displayTitle: "Clipboard",
    description: "Recent copies",
    type: "submenu",
  };

  get deprecationMessage() {
    return "The clipboard context provider is deprecated as it is not used. It will be removed in a future version.";
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Assume the query is a cache id
    const id = query.trim();
    const content = clipboardCache.get(id);

    if (content) {
      clipboardCache.select(id);
      return [
        {
          name: "Clipboard item",
          description: content.slice(0, 20),
          content,
        },
      ];
    }
    return [];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const recentClipboardItems = clipboardCache.getNItems(MAX_CLIPBOARD_ITEMS);
    console.log(recentClipboardItems);
    return recentClipboardItems.map((item, index) => {
      return {
        id: item.id,
        title: item.content.slice(0, 20),
        description: `#${index + 1}`,
      };
    });
  }
}

export default ClipboardContextProvider;
