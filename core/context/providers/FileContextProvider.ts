import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";
import { walkDirs } from "../../indexing/walkDir";
import {
  getShortestUniqueRelativeUriPaths,
  getUriDescription,
  getUriPathBasename,
} from "../../util/uri";

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
    const fileUri = query.trim();
    const content = await extras.ide.readFile(fileUri);

    const { relativePathOrBasename, last2Parts, baseName } = getUriDescription(
      fileUri,
      await extras.ide.getWorkspaceDirs(),
    );

    return [
      {
        name: baseName,
        description: last2Parts,
        content: `\`\`\`${relativePathOrBasename}\n${content}\n\`\`\``,
        uri: {
          type: "file",
          value: fileUri,
        },
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const workspaceDirs = await args.ide.getWorkspaceDirs();
    const results = await walkDirs(
      args.ide,
      {
        source: "load submenu items - file",
      },
      workspaceDirs,
    );
    const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
    const withUniquePaths = getShortestUniqueRelativeUriPaths(
      files,
      workspaceDirs,
    );

    return withUniquePaths.map((file) => {
      return {
        id: file.uri,
        title: getUriPathBasename(file.uri),
        description: file.uniquePath,
      };
    });
  }
}

export default FileContextProvider;
