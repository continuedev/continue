import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { getBasename } from "../../util";

// import { getHighlightsThatFit, ILLMContextSizer } from "llm-code-highlighter/dist/index.continue";

const HIGHLIGHTS_TOKEN_BUDGET = 2000;

class CodeHighlightsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "highlights",
    displayTitle: "Highlights",
    description: "Code highlights from open files",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const ide = extras.ide;
    const openFiles = await ide.getOpenFiles();
    const allFiles: { name: string; absPath: string; content: string }[] =
      await Promise.all(
        openFiles.map(async (filepath: string) => {
          return {
            name: getBasename(filepath),
            absPath: filepath,
            content: `${await ide.readFile(filepath)}`,
          };
        }),
      );
    // const contextSizer =  {
    //   fits(content: string): boolean {
    //     return countTokens(content, "") < HIGHLIGHTS_TOKEN_BUDGET;
    //   }
    // } as ILLMContextSizer
    // const repoMap = await getHighlightsThatFit(
    //   contextSizer,
    //   [],
    //   allFiles
    //     .filter((file) => file.content.length > 0)
    //     .map((file) => {
    //       return {
    //         relPath: file.name,
    //         code: file.content,
    //       };
    //     })
    // );
    // return [
    //   {
    //     content: repoMap ? repoMap : "",
    //     name: "Code Highlights",
    //     description: "Code highlights from open files",
    //   },
    // ];
    return [];
  }

  async load(): Promise<void> {}
}

export default CodeHighlightsContextProvider;
