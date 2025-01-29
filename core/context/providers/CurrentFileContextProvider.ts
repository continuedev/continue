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

    let prefix = "This is the currently open file:";
    let name = baseName;

    // This allows frontend to retrieve when using alt + enter or default context with slightly different copy
    if (query === "non-mention-usage") {
      prefix =
        "The following file is currently open. Don't reference it if it's not relevant to the user's message:";
      name = "Active file: " + baseName;
    }

    return [
      {
        description: relativePathOrBasename,
        content: `${prefix}\n\n\`\`\`${relativePathOrBasename}\n${currentFile.contents}\n\`\`\``,
        name,
        uri: {
          type: "file",
          value: currentFile.path,
        },
      },
    ];
  }
}

export default CurrentFileContextProvider;
