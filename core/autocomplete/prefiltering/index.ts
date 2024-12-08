import path from "node:path";

import ignore from "ignore";

import { IDE } from "../..";
import { getBasename } from "../../util";
import { getConfigJsonPath } from "../../util/paths";
import { AutocompleteContext } from "../util/AutocompleteContext";

async function isDisabledForFile(ctx: AutocompleteContext, ide: IDE) {
  if (ctx.options.disableInFiles) {
    // Relative path needed for `ignore`
    const workspaceDirs = await ide.getWorkspaceDirs();
    let filepath = ctx.filepath;
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
    if (filepath === ctx.filepath) {
      filepath = getBasename(filepath);
    }

    // @ts-ignore
    const pattern = ignore.default().add(ctx.options.disableInFiles);
    const result = pattern.ignores(filepath);

    if (ctx.options.logDisableInFiles)
      ctx.writeLog(
        `Options.disableInFiles=${ctx.options.disableInFiles}; file: ${filepath} file ignored: ${result}`,
      );
    return result;
  } else {
    if (ctx.options.logDisableInFiles)
      ctx.writeLog("Options.disableInFiles is not set, not ignoring file");
    return false;
  }
}

export async function shouldPrefilter(
  ctx: AutocompleteContext,
  ide: IDE,
): Promise<boolean> {
  // Allow disabling autocomplete from config.json
  if (ctx.options.disable) {
    return true;
  }

  // Check whether we're in the continue config.json file
  if (ctx.filepath === getConfigJsonPath()) {
    return true;
  }

  // Check whether autocomplete is disabled for this file
  if (await isDisabledForFile(ctx, ide)) {
    return true;
  }

  return false;
}
