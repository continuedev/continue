import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { getBasename } from "../../util";

// import { getOutlines } from "llm-code-highlighter/dist/index.continue";

class CodeOutlineContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "outline",
    displayTitle: "Outline",
    description: "Definition lines only (from open files)",
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
    // const outlines = await getOutlines(
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
    //     content: outlines ? outlines : "",
    //     name: "Code Outline",
    //     description: "Definition lines only (from open files)",
    //   },
    // ];
    return [];
  }

  async load(): Promise<void> {}
}

export default CodeOutlineContextProvider;
