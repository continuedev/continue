import { ContextProvider, ContextProviderDescription } from "..";
import { ExtensionIde } from "../../ide";
import { ContextItem } from "../../llm/types";

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

class FileTreeContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "tree",
    displayTitle: "File Tree",
    description: "Attach a representation of the file tree",
    dynamic: true,
    requiresQuery: false,
  };

  async getContextItem(query: string): Promise<ContextItem[]> {
    const workspaceDir = await new ExtensionIde().getWorkspaceDir();
    const contents = await new ExtensionIde().listWorkspaceContents();

    const tree: Directory = {
      name: splitPath(workspaceDir).pop(),
      files: [],
      directories: [],
    };

    for (let file of contents) {
      const parts = splitPath(file, workspaceDir);

      let currentTree = tree;
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

    return [
      {
        content: formatFileTree(tree),
        name: "File Tree",
        description: "File Tree",
        id: {
          providerTitle: "tree",
          itemId: workspaceDir,
        },
      },
    ];
  }
  async load(): Promise<void> {}
}

export default FileTreeContextProvider;
