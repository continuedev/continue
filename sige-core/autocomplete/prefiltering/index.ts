import ignore from "ignore";

import { IDE } from "../..";
import {
  getGlobalContinueIgArray,
  getWorkspaceContinueIgArray,
} from "../../indexing/continueignore";
import { getConfigJsonPath } from "../../util/paths";
import { findUriInDirs } from "../../util/uri";
import { HelperVars } from "../util/HelperVars";

async function isDisabledForFile(
  currentFilepath: string,
  disableInFiles: string[] | undefined,
  ide: IDE,
) {
  if (disableInFiles) {
    // Relative path needed for `ignore`
    const workspaceDirs = await ide.getWorkspaceDirs();
    const { relativePathOrBasename } = findUriInDirs(
      currentFilepath,
      workspaceDirs,
    );

    // @ts-ignore
    const pattern = ignore.default().add(disableInFiles);
    if (pattern.ignores(relativePathOrBasename)) {
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
  const disableInFiles = [
    ...(helper.options.disableInFiles ?? []),
    "*.prompt",
    ...getGlobalContinueIgArray(),
    ...(await getWorkspaceContinueIgArray(ide)),
  ];
  if (await isDisabledForFile(helper.filepath, disableInFiles, ide)) {
    return true;
  }

  // Don't offer completions when we have no information (untitled file and no file contents)
  if (
    helper.filepath.includes("Untitled") &&
    helper.fileContents.trim() === ""
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
