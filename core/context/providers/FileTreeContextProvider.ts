import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

interface Directory {
  name: string;
  files: string[];
  directories: Directory[];
}

function splitPath(path: string, withRoot?: string): string[] {
  let parts = path.includes("/") ? path.split("/") : path.split("\\");
  if (withRoot !== undefined) {
    let rootParts = splitPath(withRoot);
    parts = parts.slice(rootParts.length - 1);
  }
  return parts;
}

function formatFileTree(tree: Directory, indentation: string = ""): string {
  let result = "";
  for (let file of tree.files) {
    result += `${indentation}${file}\n`;
  }

  for (let directory of tree.directories) {
    result += `${indentation}${directory.name}/\n`;
    result += formatFileTree(directory, indentation + "  ");
  }

  return result;
}

class FileTreeContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "tree",
    displayTitle: "File Tree",
    description: "Attach a representation of the file tree",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    let trees = [];

    for (let workspaceDir of workspaceDirs) {
      const contents = await extras.ide.listWorkspaceContents(workspaceDir);

      const subDirTree: Directory = {
        name: splitPath(workspaceDir).pop() || "",
        files: [],
        directories: [],
      };

      for (let file of contents) {
        const parts = splitPath(file, workspaceDir);

        let currentTree = subDirTree;
        for (let part of parts.slice(0, -1)) {
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
        content:
          "Here is a file tree of the current workspace:\n\n" +
          trees.join("\n\n"),
        name: "File Tree",
        description: "File Tree",
      },
    ];
  }
}

export default FileTreeContextProvider;
