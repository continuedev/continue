import * as fs from "fs";
import * as path from "path";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../";
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex.js";
import { getRepoMapFilePath } from "../../util/paths";
import { BaseContextProvider } from "..";

class RepoMapContextProvider extends BaseContextProvider {
  repoMapPreamble =
    "Below is a repository map. \n" +
    "For each file in the codebase, " +
    "this map contains the name of the file, and the signature for any " +
    "classes, methods, or functions in the file.\n\n";

  // The max percent of the context window we will take
  REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;

  static description: ContextProviderDescription = {
    title: "repo-map",
    displayTitle: "Repository Map",
    description: "List of files and signatures",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return [
      {
        name: "Repository Map",
        description: "Overview of the repository structure",
        content: await this.generateRepoMap(extras),
      },
    ];
  }

  private indentMultilineString(str: string) {
    return str
      .split("\n")
      .map((line: any) => "\t" + line)
      .join("\n");
  }

  private async generateRepoMap({ llm, ide }: ContextProviderExtras) {
    const repoMapPath = getRepoMapFilePath();
    const workspaceDirs = await ide.getWorkspaceDirs();
    const maxRepoMapTokens =
      llm.contextLength * this.REPO_MAX_CONTEXT_LENGTH_RATIO;

    if (fs.existsSync(repoMapPath)) {
      console.debug(`Overwriting existing repo map at ${repoMapPath}`);
    }

    const writeStream = fs.createWriteStream(repoMapPath);
    writeStream.write(this.repoMapPreamble);

    let curTokens = llm.countTokens(this.repoMapPreamble);
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const { groupedByPath, hasMore } =
        await CodeSnippetsCodebaseIndex.getPathsAndSignatures(
          workspaceDirs,
          offset,
          batchSize,
        );

      let content = "";

      for (const [absolutePath, signatures] of Object.entries(groupedByPath)) {
        const workspaceDir =
          workspaceDirs.find((dir) => absolutePath.startsWith(dir)) || "";

        const relativePath = path.relative(workspaceDir, absolutePath);
        content += `${relativePath}:\n`;

        for (const signature of signatures.slice(0, -1)) {
          content += `${this.indentMultilineString(signature)}\n\t...\n`;
        }

        if (signatures.length > 0) {
          // Don't add the trailing ellipsis for the last entry
          content += `${this.indentMultilineString(
            signatures[signatures.length - 1],
          )}\n\n`;
        }
      }

      curTokens += llm.countTokens(content);

      if (curTokens >= maxRepoMapTokens) {
        break;
      }

      writeStream.write(content);

      if (!hasMore) {
        break;
      }

      offset += batchSize;
    }

    writeStream.end();
    console.debug(`Generated repo map at ${repoMapPath}`);

    if (curTokens >= maxRepoMapTokens) {
      console.debug(
        "Full repo map was unable to be genereated due to context window limitations",
      );
    }

    const repoMap = fs.readFileSync(repoMapPath, "utf8");

    return repoMap;
  }
}

export default RepoMapContextProvider;
