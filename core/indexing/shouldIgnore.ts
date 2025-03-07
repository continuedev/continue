import ignore from "ignore";
import { FileType, IDE } from "../index";
import { getUriPathBasename } from "../util/uri";
import { getGlobalContinueIgArray, gitIgArrayFromFile } from "./ignore";

interface IgnoreContext {
  ignore: ReturnType<typeof ignore>;
  dirname: string;
}

export async function shouldIgnore(
  fileUri: string,
  rootDirUri: string,
  ide: IDE,
  ignoreFiles: string[] = [".gitignore", ".continueignore"],
): Promise<boolean> {
  let currentDir = fileUri;

  while (currentDir !== rootDirUri && currentDir.startsWith(rootDirUri)) {
    const dirEntries = await ide.listDir(currentDir);
    const dirs = dirEntries
      .filter(([_, uriType]) => uriType === FileType.File)
      .map(([uri, _]) => uri);

    const ignoreContexts = await getIgnoreContextsInDir(
      currentDir,
      dirs,
      ignoreFiles,
      ide,
    );

    const relativePath = fileUri.substring(currentDir.length + 1);

    for (const context of ignoreContexts) {
      if (context.ignore.ignores(relativePath)) {
        return true;
      }
    }

    currentDir = getParentDir(currentDir);
  }

  return false;
}

async function getIgnoreContextsInDir(
  dirUri: string,
  entries: string[],
  ignoreFiles: string[],
  ide: IDE,
): Promise<IgnoreContext[]> {
  const ignoreEntries = entries.filter((entryUri) =>
    ignoreFiles.includes(getUriPathBasename(entryUri)),
  );
  const patterns = await Promise.all(
    ignoreEntries.map(async (entryUri) => {
      const fileContent = await ide.readFile(entryUri);
      return gitIgArrayFromFile(fileContent);
    }),
  );

  const globalPatterns = getGlobalContinueIgArray();

  return [
    ...patterns.map((patterns) => ({
      ignore: ignore().add(patterns),
      dirname: dirUri,
    })),
    {
      ignore: ignore().add(globalPatterns),
      dirname: "/",
    },
  ];
}

function getParentDir(uri: string): string {
  const splitUri = uri.split("/");
  splitUri.pop();
  return splitUri.join("/");
}
