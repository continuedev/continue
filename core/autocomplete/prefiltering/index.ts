import path from "node:path";

import { IDE } from "../..";
import { getBasename } from "../../util";
import { getConfigJsonPath } from "../../util/paths";
import { HelperVars } from "../util/HelperVars";

async function isDisabledForFile(
  currentFilepath: string,
  disableInFiles: string[] | undefined,
  ide: IDE,
) {
  if (disableInFiles) {
    // Relative path needed for `ignore`
    const workspaceDirs = await ide.getWorkspaceDirs();
    let filepath = currentFilepath;
    for (const workspaceDir of workspaceDirs) {
      const relativePath = path.relative(workspaceDir, filepath);
      const relativePathBase = relativePath.split(path.sep).at(0);
      const isInWorkspace =
        !path.isAbsolute(relativePath) && relativePathBase !== "..";
      if (isInWorkspace) {
        filepath = path.relative(workspaceDir, filepath);
        break;
      }
    }

    // Worst case we can check filetype glob patterns
    if (filepath === currentFilepath) {
      filepath = getBasename(filepath);
    }

    // @ts-ignore
    const pattern = ignore.default().add(options.disableInFiles);
    if (pattern.ignores(filepath)) {
      return true;
    }
  }
}

async function shouldLanguageSpecificPrefilter(helper: HelperVars) {
  const line = helper.fileLines[helper.pos.line] ?? "";
  for (const endOfLine of helper.lang.endOfLine) {
    if (line.endsWith(endOfLine) && helper.pos.character >= line.length) {
      return true;
    }
  }
}

export async function shouldPrefilter(
  helper: HelperVars,
  ide: IDE,
): Promise<boolean> {
  // Allow disabling autocomplete from config.json
  if (helper.options.disable) {
    return true;
  }

  // Check whether we're in the continue config.json file
  if (helper.filepath === getConfigJsonPath()) {
    return true;
  }

  // Check whether autocomplete is disabled for this file
  if (
    await isDisabledForFile(helper.filepath, helper.options.disableInFiles, ide)
  ) {
    return true;
  }

  // if (
  //   helper.options.transform &&
  //   (await shouldLanguageSpecificPrefilter(helper))
  // ) {
  //   return true;
  // }

  return false;
}
