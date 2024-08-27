import * as fs from "fs";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { CodeSnippetsCodebaseIndex } from "../../indexing/CodeSnippetsIndex.js";
import { BaseContextProvider } from "../index.js";
import { getRepoMapFilePath } from "../../util/paths.js";

class RepoMapContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "repo_map",
    displayTitle: "Repository Map",
    description: "Overview of the repository structure",
    type: "default",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const repoMapPath = getRepoMapFilePath();
    
    if (!fs.existsSync(repoMapPath)) {
      await this.generateRepoMap();
    }

    const content = fs.readFileSync(repoMapPath, "utf8");
    return [
      {
        name: "Repository Map",
        description: "Overview of the repository structure",
        content,
      },
    ];
  }

  private async generateRepoMap(): Promise<void> {
    const repoMapPath = getRepoMapFilePath();
    
    if (fs.existsSync(repoMapPath)) {
      console.log(`Overwriting existing repo map at ${repoMapPath}`);
    }

    const writeStream = fs.createWriteStream(repoMapPath);
    writeStream.write("Repository Map:\n\n");

    for await (const { path, signatures } of CodeSnippetsCodebaseIndex.getAllPathsAndSignatures()) {
      writeStream.write(`${path}:\n`);
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
