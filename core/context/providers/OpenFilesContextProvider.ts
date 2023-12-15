import { v4 } from "uuid";
import { BaseContextProvider } from "..";
import { ContextItem, ContextProviderDescription } from "../..";
import { ExtensionIde } from "../../ide";

class OpenFilesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "open",
    displayTitle: "Open Files",
    description: "Reference the current open files",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    const ide = new ExtensionIde();
    const openFiles = await ide.getOpenFiles();
    return await Promise.all(
      openFiles.map(async (filepath: string) => {
        return {
          description: filepath,
          content: await ide.readFile(filepath),
          name: (filepath.split("/").pop() || "").split("\\").pop() || "",
          // TODO: id can be determined outside of this function
          id: {
            providerTitle: "open",
            itemId: v4(),
          },
        };
      })
    );
  }
  async load(): Promise<void> {}
}

export default OpenFilesContextProvider;
