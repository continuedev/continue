import { IDE } from "../..";
import { walkDir } from "../../indexing/walkDir";
import { getPathModuleForIde } from "../../util/pathModule";
import { readAllGlobalPromptFiles } from "../../util/paths";

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
    const results = paths.map(async (path) => {
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
  const pathModule = await getPathModuleForIde(ide);

  promptFiles = (
    await Promise.all(
      workspaceDirs.map((dir) =>
        getPromptFilesFromDir(
          ide,
          pathModule.join(
            dir,
            overridePromptFolder ?? pathModule.join(".continue", "prompts"),
          ),
        ),
      ),
    )
  )
    .flat()
    .filter(({ path }) => path.endsWith(".prompt"));

  // Also read from ~/.continue/.prompts
  promptFiles.push(...readAllGlobalPromptFiles());

  return await Promise.all(
    promptFiles.map(async (file) => {
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
