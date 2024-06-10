import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { getBasename, getLastNPathParts } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

class FolderContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "folder",
    displayTitle: "Folder",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { retrieveContextItemsFromEmbeddings } = await import(
      "../retrieval/retrieval.js"
    );
    return retrieveContextItemsFromEmbeddings(extras, this.options, query);
  }
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const folders = await args.ide.listFolders();
    return folders.map((folder) => {
      return {
        id: folder,
        title: getBasename(folder),
        description: getLastNPathParts(folder, 2),
      };
    });
  }
}

export default FolderContextProvider;
