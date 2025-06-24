import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { formatCodeblock } from "../../util/formatCodeblock.js";
import { getUriDescription } from "../../util/uri.js";
import { BaseContextProvider } from "../index.js";

class ProblemsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "problems",
    displayTitle: "Problems",
    description: "Reference problems in the current file",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const ide = extras.ide;
    const problems = await ide.getProblems();
    const workspaceDirs = await ide.getWorkspaceDirs();

    type FileCache = {
      lines: string[];
      desc: ReturnType<typeof getUriDescription>;
    };
    const files: Map<string, FileCache> = new Map();

    const items = await Promise.all(
      problems.map(async (problem) => {
        let cachedFile: FileCache;
        if (files.has(problem.filepath)) {
          cachedFile = files.get(problem.filepath)!;
        } else {
          const content = await ide.readFile(problem.filepath);
          const desc = getUriDescription(problem.filepath, workspaceDirs);
          const lines = content.split("\n");
          cachedFile = { lines, desc };
          files.set(problem.filepath, cachedFile);
        }

        const { relativePathOrBasename, baseName, extension } = cachedFile.desc;

        const rangeContent = cachedFile.lines
          .slice(
            Math.max(0, problem.range.start.line - 2),
            problem.range.end.line + 2,
          )
          .join("\n");

        const codeblock = formatCodeblock(
          relativePathOrBasename,
          rangeContent,
          extension,
          problem.range,
        );

        return {
          description: "Problems in current file",
          content: `${codeblock}\n${problem.message}\n\n`,
          name: `Warning in ${baseName}`,
        };
      }),
    );

    return items.length === 0
      ? [
          {
            description: "Problems in current file",
            content: "There are no problems found in the open file.",
            name: "No problems found",
          },
        ]
      : items;
  }
}

export default ProblemsContextProvider;
