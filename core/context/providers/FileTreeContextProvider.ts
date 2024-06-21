import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { splitPath } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

interface Directory {
  name: string;
  files: string[];
  directories: Directory[];
}

function formatFileTree(tree: Directory, indentation = ""): string {
  let result = "";
  for (const file of tree.files) {
    result += `${indentation}${file}\n`;
  }

  for (const directory of tree.directories) {
    result += `${indentation}${directory.name}/\n`;
    result += formatFileTree(directory, `${indentation}  `);
  }

  return result;
}

class FileTreeContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "tree",
    displayTitle: "File Tree",
    description: "Attach a representation of the file tree",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const trees = [];

    for (const workspaceDir of workspaceDirs) {
      const contents = await extras.ide.listWorkspaceContents(workspaceDir);

      const subDirTree: Directory = {
        name: splitPath(workspaceDir).pop() ?? "",
        files: [],
        directories: [],
      };

      for (const file of contents) {
        const parts = splitPath(file, workspaceDir);

        let currentTree = subDirTree;
        for (const part of parts.slice(0, -1)) {
          if (!currentTree.directories.some((d) => d.name === part)) {
            currentTree.directories.push({
              name: part,
              files: [],
              directories: [],
            });
          }

          currentTree = currentTree.directories.find((d) => d.name === part)!;
        }

        currentTree.files.push(parts.pop()!);
      }

      trees.push(formatFileTree(subDirTree));
    }

    return [
      {
        content: `Here is a file tree of the current workspace:\n\n${trees.join(
          "\n\n",
        )}`,
        name: "File Tree",
        description: "File Tree",
      },
    ];
  }
}

export default FileTreeContextProvider;
