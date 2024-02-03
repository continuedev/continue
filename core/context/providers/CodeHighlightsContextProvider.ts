import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

const highlighterPromise = import("llm-code-highlighter/dist/index.continue");

class CodeHighlightsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "highlights",
    displayTitle: "Highlights",
    description: "Code highlights from open files",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const ide = extras.ide;
    const openFiles = await ide.getOpenFiles();
    const allFiles: { name: string; absPath: string; content: string }[] =
      await Promise.all(
        openFiles.map(async (filepath: string) => {
          return {
            name: (filepath.split("/").pop() || "").split("\\").pop() || "",
            absPath: filepath,
            content: `${await ide.readFile(filepath)}`,
          };
        })
      );
    const topPercentile = 0.5;
    const highlighter = await highlighterPromise;
    const repoMap = await highlighter.getRepoHighlights(
      topPercentile,
      [],
      allFiles
        .filter((file) => file.content.length > 0)
        .map((file) => {
          return {
            relPath: file.name,
            code: file.content,
          };
        })
    );
    return [
      {
        content: repoMap,
        name: "Code Highlights",
        description: "Code highlights from open files",
      },
    ];
  }

  async load(): Promise<void> {}
}

export default CodeHighlightsContextProvider;
