import { getContinueGlobalPath } from "core/util/paths";
import fs from "node:fs";
import { ExtensionContext } from "vscode";
/**
 * Clear all Continue-related artifacts to simulate a brand new user
 */
export function cleanSlate(context: ExtensionContext) {
  // Remove ~/.continue
  const continuePath = getContinueGlobalPath();
  if (fs.existsSync(continuePath)) {
    fs.rmSync(continuePath, { recursive: true });
  }

  // Clear extension's globalState
  context.globalState.keys().forEach((key) => {
    context.globalState.update(key, undefined);
  });
}
