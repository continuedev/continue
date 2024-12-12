import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { walkDirInWorkspaces } from "../../indexing/walkDir.js";
import {
  getUniqueUriPath,
  getUriPathBasename,
  groupByLastNPathParts,
} from "../../util/uri.js";
import { BaseContextProvider } from "../index.js";
import { retrieveContextItemsFromEmbeddings } from "../retrieval/retrieval.js";

class FolderContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "folder",
    displayTitle: "Folder",
    description: "Type to search",
    type: "submenu",
    dependsOnIndexing: true,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return retrieveContextItemsFromEmbeddings(extras, this.options, query);
  }
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const folders = await walkDirInWorkspaces(args.ide, {
      onlyDirs: true,
    });
    const folderGroups = groupByLastNPathParts(folders, 2);

    return folders.map((folder) => {
      return {
        id: folder,
        title: getUriPathBasename(folder),
        description: getUniqueUriPath(folder, folderGroups),
      };
    });
  }
}

export default FolderContextProvider;
