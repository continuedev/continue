import fs from "fs";
import { pathToFileURL } from "node:url";
import { IDE } from "../..";
import { SYSTEM_PROMPT_DOT_FILE } from "../../config/getWorkspaceContinueRuleDotFiles";
import {
  getGlobalContinueIgArray,
  gitIgArrayFromFile,
} from "../../indexing/ignore";
import { getGlobalGraniteIgnorePath } from "../../util/paths";
import { joinPathsToUri } from "../../util/uri";
export const GRANITE_SYSTEM_PROMPT_DOT_FILE = ".graniterules";
export const GRANITE_IGNORE_DOT_FILE = ".graniteignore";

type DotFilesMode = "granite" | "continue";

async function checkCurrentDirDotFileMode(
  ide: IDE,
  dotFileName: string,
  curDir: string,
): Promise<DotFilesMode> {
  const dotFilePath = joinPathsToUri(curDir, dotFileName);
  const exists = await ide.fileExists(dotFilePath);
  if (exists) {
    return "granite";
  }
  return "continue";
}

async function checkGlobalIgnoreFileMode(ide: IDE): Promise<DotFilesMode> {
  const graniteGlobalIgnoreFilePath = getGlobalGraniteIgnorePath();
  const fileUrl = pathToFileURL(graniteGlobalIgnoreFilePath).href;

  if (await ide.fileExists(fileUrl)) {
    return "granite";
  }

  return "continue";
}

async function checkRulesDotFilesMode(
  ide: IDE,
  curDir: string,
): Promise<DotFilesMode> {
  return checkCurrentDirDotFileMode(
    ide,
    GRANITE_SYSTEM_PROMPT_DOT_FILE,
    curDir,
  );
}

async function checkIgnoreDotFilesMode(
  ide: IDE,
  curDir: string,
): Promise<DotFilesMode> {
  return checkCurrentDirDotFileMode(ide, GRANITE_IGNORE_DOT_FILE, curDir);
}

export async function getIgnoreDotFile(
  ide: IDE,
  curDir: string,
): Promise<string> {
  return (await checkIgnoreDotFilesMode(ide, curDir)) === "granite"
    ? GRANITE_IGNORE_DOT_FILE
    : ".continueignore";
}

export async function getRulesDotFile(
  ide: IDE,
  curDir: string,
): Promise<string> {
  return (await checkRulesDotFilesMode(ide, curDir)) === "granite"
    ? GRANITE_SYSTEM_PROMPT_DOT_FILE
    : SYSTEM_PROMPT_DOT_FILE;
}

export async function getGlobalIgnoreArray(ide: IDE): Promise<string[]> {
  return (await checkGlobalIgnoreFileMode(ide)) === "granite"
    ? getGlobalGraniteIgArray()
    : getGlobalContinueIgArray();
}

const getGlobalGraniteIgArray = () => {
  try {
    const contents = fs.readFileSync(getGlobalGraniteIgnorePath(), "utf8");
    return gitIgArrayFromFile(contents);
  } catch (e) {
    return [];
  }
};
