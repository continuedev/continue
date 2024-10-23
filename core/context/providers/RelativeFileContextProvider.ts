import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { walkDir } from "../../indexing/walkDir.js";
import {
  getBasename,
  getUniqueFilePath,
  groupByLastNPathParts,
} from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

const MAX_SUBMENU_ITEMS = 10_000;

class RelativeFileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "relativefilecontext",
    displayTitle: "Files",
    description: "Add file to context.",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const relativePath = this.normalizeRelativePath(query, workspaceDirs[0]);
    return [
      {
        name: getBasename(query),
        description: relativePath,
        content: relativePath,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const results = await Promise.all(
      workspaceDirs.map((dir) => {
        return walkDir(dir, args.ide);
      }),
    );
    const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
    const fileGroups = groupByLastNPathParts(files, 2);

    return files.map((file) => {
      const relativePath = this.normalizeRelativePath(file, workspaceDirs[0]);
      return {
        id: file,
        title: getBasename(file),
        description: relativePath,
      };
    });
  }

  private normalizeRelativePath(path: string, workspaceDir: string): string {
    const relativePath = path.replace(workspaceDir, "").replace(/^[\/\\]/, "");
    return relativePath.replace(/\\/g, "/");
  }
}

export default RelativeFileContextProvider;
