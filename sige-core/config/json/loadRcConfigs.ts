import * as JSONC from "comment-json";
import { ContinueRcJson, FileType, IDE } from "../..";
import { joinPathsToUri } from "../../util/uri";

export async function getWorkspaceRcConfigs(
  ide: IDE,
): Promise<ContinueRcJson[]> {
  try {
    const workspaces = await ide.getWorkspaceDirs();
    const rcFiles = await Promise.all(
      workspaces.map(async (dir) => {
        const ls = await ide.listDir(dir);
        const rcFiles = ls
          .filter(
            (entry) =>
              (entry[1] === (1 as FileType.File) ||
                entry[1] === (64 as FileType.SymbolicLink)) &&
              entry[0].endsWith(".continuerc.json"),
          )
          .map((entry) => joinPathsToUri(dir, entry[0]));
        return await Promise.all(rcFiles.map(ide.readFile));
      }),
    );
    return rcFiles
      .flat()
      .map((file) => JSONC.parse(file) as unknown as ContinueRcJson);
  } catch (e) {
    console.debug("Failed to load workspace configs: ", e);
    return [];
  }
}
