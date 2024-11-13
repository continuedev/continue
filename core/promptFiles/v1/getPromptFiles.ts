import { IDE } from "../..";
import { walkDir } from "../../indexing/walkDir";

export async function getPromptFiles(
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
