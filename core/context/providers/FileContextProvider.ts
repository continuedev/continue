import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { getBasename, getLastNPathParts } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

const MAX_SUBMENU_ITEMS = 10_000;

class FileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "file",
    displayTitle: "Files",
    description: "Type to search",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Assume the query is a filepath
    query = query.trim();
    const content = await extras.ide.readFile(query);
    return [
      {
        name: query.split(/[\\/]/).pop() ?? query,
        description: query,
        content: `\`\`\`${query}\n${content}\n\`\`\``,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        return args.ide.listWorkspaceContents(dir);
      }),
    );
    const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
    return files.map((file) => {
      return {
        id: file,
        title: getBasename(file),
        description: getLastNPathParts(file, 2),
      };
    });
  }
}

export default FileContextProvider;
