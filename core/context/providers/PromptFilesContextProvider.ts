import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../";
import { getAllPromptFilesV2 } from "../../promptFiles/v2/getPromptFiles";
import { parsePreamble } from "../../promptFiles/v2/parse";
import { renderPromptFileV2 } from "../../promptFiles/v2/renderPromptFile";

class PromptFilesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "prompt-files",
    displayTitle: "Prompt Files",
    description: ".prompt files",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const rawContent = await extras.ide.readFile(query);
    const preamble = parsePreamble(query, rawContent);
    const [contextItems, body] = await renderPromptFileV2(rawContent, extras);
    return [
      ...contextItems,
      {
        content: body,
        name: preamble.name,
        description: preamble.description,
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const promptFiles = await getAllPromptFilesV2(
      args.ide,
      args.config.experimental?.promptPath,
    );
    return promptFiles.map((file) => {
      const preamble = parsePreamble(file.path, file.content);
      return {
        id: file.path,
        title: preamble.name,
        description: preamble.description,
      };
    });
  }
}

export default PromptFilesContextProvider;
