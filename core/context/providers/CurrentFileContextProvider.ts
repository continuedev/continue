import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../";
import { findUriInDirs, getUriPathBasename } from "../../util/uri";

class CurrentFileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "currentFile",
    displayTitle: "Current File",
    description: "Reference the currently open file",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const currentFile = await extras.ide.getCurrentFile();
    if (!currentFile) {
      return [];
    }
    const { relativePathOrBasename } = findUriInDirs(
      currentFile.path,
      await extras.ide.getWorkspaceDirs(),
    );
    const baseName = getUriPathBasename(currentFile.path);
    return [
      {
        description: relativePathOrBasename,
        content: `This is the currently open file:\n\n\`\`\`${relativePathOrBasename}\n${currentFile.contents}\n\`\`\``,
        name: baseName,
        uri: {
          type: "file",
          value: currentFile.path,
        },
      },
    ];
  }
}

export default CurrentFileContextProvider;
