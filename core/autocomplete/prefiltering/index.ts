import path from "node:path";
import { IDE, Position, TabAutocompleteOptions } from "../..";
import { getBasename } from "../../util";
import { getConfigJsonPath } from "../../util/paths";
import { languageForFilepath } from "../constructPrompt";
import { AutocompleteInput } from "../types";

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

async function shouldLanguageSpecificPrefilter(
  manuallyPassFileContents: string | undefined,
  filepath: string,
  pos: Position,
  ide: IDE,
) {
  const lang = languageForFilepath(filepath);
  const fileContents =
    manuallyPassFileContents ?? (await ide.readFile(filepath));
  const fileLines = fileContents.split("\n");
  const line = fileLines[pos.line] ?? "";
  for (const endOfLine of lang.endOfLine) {
    if (line.endsWith(endOfLine) && pos.character >= line.length) {
      return true;
    }
  }
}

export async function shouldPrefilter(
  input: AutocompleteInput,
  options: TabAutocompleteOptions,
  ide: IDE,
): Promise<boolean> {
  // Allow disabling autocomplete from config.json
  if (options.disable) {
    return true;
  }

  // Check whether we're in the continue config.json file
  if (input.filepath === getConfigJsonPath()) {
    return true;
  }

  // Check whether autocomplete is disabled for this file
  if (await isDisabledForFile(input.filepath, options.disableInFiles, ide)) {
    return true;
  }

  if (
    options.transform &&
    (await shouldLanguageSpecificPrefilter(
      input.manuallyPassFileContents,
      input.filepath,
      input.pos,
      ide,
    ))
  ) {
    return true;
  }

  return false;
}
