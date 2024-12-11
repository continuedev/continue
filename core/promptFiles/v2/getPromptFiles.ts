import { IDE } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { readAllGlobalPromptFiles } from "../../util/paths";
import { joinPathsToUri } from "../../util/uri";

async function getPromptFilesFromDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);

    if (!exists) {
      return [];
    }

    const paths = await walkDir(dir, ide, { ignoreFiles: [] });
    const promptFilePaths = paths.filter((p) => p.endsWith(".prompt"));
    const results = promptFilePaths.map(async (path) => {
      const content = await ide.readFile(path); // make a try catch
      return { path, content };
    });
    return Promise.all(results);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getAllPromptFilesV2(
  ide: IDE,
  overridePromptFolder?: string,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  let promptFiles: { path: string; content: string }[] = [];

  promptFiles = (
    await Promise.all(
      workspaceDirs.map((dir) =>
        getPromptFilesFromDir(
          ide,
          joinPathsToUri(dir, overridePromptFolder ?? ".continue/prompts"),
        ),
      ),
    )
  ).flat();

  // Also read from ~/.continue/.prompts
  promptFiles.push(...readAllGlobalPromptFiles());

  return await Promise.all(
    promptFiles.map(async (file) => {
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
