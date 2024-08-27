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

  static description: ContextProviderDescription = {
    title: "repo_map",
    displayTitle: "Repository Map",
    description: "Overview of the repository structure",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const repoMapPath = getRepoMapFilePath();

    await this.generateRepoMap(extras);

    const content = fs.readFileSync(repoMapPath, "utf8");

    return [
      {
        name: "Repository Map",
        description: "Overview of the repository structure",
        content,
      },
    ];
  }

  private async generateRepoMap(extras: ContextProviderExtras): Promise<void> {
    const repoMapPath = getRepoMapFilePath();
    const [workspaceDir] = await extras.ide.getWorkspaceDirs();

    if (fs.existsSync(repoMapPath)) {
      console.log(`Overwriting existing repo map at ${repoMapPath}`);
    }

    const writeStream = fs.createWriteStream(repoMapPath);
    writeStream.write(this.repoMapPreamble);

    for await (const {
      path: absolutePath,
      signatures,
    } of CodeSnippetsCodebaseIndex.getAllPathsAndSignatures(workspaceDir)) {
      const relativePath = path.relative(workspaceDir, absolutePath);

      writeStream.write(`${relativePath}:\n`);

      for (const signature of signatures) {
        writeStream.write(`  ${signature}\n`);
      }

      writeStream.write("\n");
    }

    writeStream.end();
    console.log(`Generated repo map at ${repoMapPath}`);
  }
}

export default RepoMapContextProvider;
