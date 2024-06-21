import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { getBasename } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

const HIGHLIGHTS_TOKEN_BUDGET = 2000;

class CodeHighlightsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "highlights",
    displayTitle: "Highlights",
    description: "Code highlights from open files",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // const { getHighlightsThatFit } = await import(
    //   "llm-code-highlighter/src/index.continue.js"
    // );
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
    // const contextSizer = {
    //   fits(content: string): boolean {
    //     return countTokens(content, "") < HIGHLIGHTS_TOKEN_BUDGET;
    //   },
    // };
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
    //     }),
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
