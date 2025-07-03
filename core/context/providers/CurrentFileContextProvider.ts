import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../";
import { formatCodeblock } from "../../util/formatCodeblock";
import { getUriDescription } from "../../util/uri";

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

    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const { relativePathOrBasename, last2Parts, baseName, extension } =
      getUriDescription(currentFile.path, workspaceDirs);

    let prefix = "This is the currently open file:";
    let name = baseName;

    // This allows frontend to retrieve when using alt + enter or default context with slightly different copy
    if (query === "non-mention-usage") {
      prefix =
        "The following file is currently open. Don't reference it if it's not relevant to the user's message:";
      name = "Active file: " + baseName;
    }

    const codeblock = formatCodeblock(
      relativePathOrBasename,
      currentFile.contents,
      extension,
    );
    return [
      {
        description: last2Parts,
        content: `${prefix}\n\n${codeblock}`,
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
