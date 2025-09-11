import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { isSecurityConcern } from "../../indexing/ignore.js";
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

    const items = await Promise.all(
      problems.map(async (problem) => {
        const { relativePathOrBasename, baseName } = getUriDescription(
          problem.filepath,
          workspaceDirs,
        );
        const content = await ide.readFile(problem.filepath);
        const lines = content.split("\n");
        const rangeContent = lines
          .slice(
            Math.max(0, problem.range.start.line - 2),
            problem.range.end.line + 2,
          )
          .join("\n");

        return {
          description: "Problems in current file",
          content: `\`\`\`${relativePathOrBasename}\n${rangeContent}\n\`\`\`\n${problem.message}\n\n`,
          name: `Warnings in ${baseName}`,
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
