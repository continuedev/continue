import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { findUriInDirs, getUriPathBasename } from "../../util/uri.js";
import { BaseContextProvider } from "../index.js";

class OpenFilesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "open",
    displayTitle: "Open Files",
    description: "Reference the current open files",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const ide = extras.ide;
    const openFiles = this.options?.onlyPinned
      ? await ide.getPinnedFiles()
      : await ide.getOpenFiles();
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    return await Promise.all(
      openFiles.map(async (filepath: string) => {
        return {
          description: filepath,
          content: `\`\`\`${
            findUriInDirs(filepath, workspaceDirs).relativePathOrBasename
          }\n${await ide.readFile(filepath)}\n\`\`\``,
          name: getUriPathBasename(filepath),
          uri: {
            type: "file",
            value: filepath,
          },
        };
      }),
    );
  }
}

export default OpenFilesContextProvider;
