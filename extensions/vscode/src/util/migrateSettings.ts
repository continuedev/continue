import * as vscode from "vscode";

const OLD_PREFIX = "continue.";
const NEW_PREFIX = "continuous.";
const GLOBAL_DONE_KEY = "continuous.settingsMigrated";
const WORKSPACE_DONE_KEY = "continuous.workspaceSettingsMigrated";

/** The settings this extension contributes, read from its manifest. */
export function contributedSettingKeys(packageJSON: any): string[] {
  const configuration = packageJSON?.contributes?.configuration;
  const sections = Array.isArray(configuration)
    ? configuration
    : configuration
      ? [configuration]
      : [];
  return sections
    .flatMap((section: any) => Object.keys(section?.properties ?? {}))
    .filter((key: string) => key.startsWith(NEW_PREFIX));
}

interface Scope {
  target: vscode.ConfigurationTarget;
  pick: (inspected: any) => unknown;
}

const USER: Scope = {
  target: vscode.ConfigurationTarget.Global,
  pick: (i) => i?.globalValue,
};
const WORKSPACE: Scope = {
  target: vscode.ConfigurationTarget.Workspace,
  pick: (i) => i?.workspaceValue,
};

/**
 * Copy each `continue.*` setting to its `continuous.*` name. Continued
 * (and the Continue extension it was forked from) used `continue.*`; VS Code
 * still returns those values from settings.json after the names stop being
 * contributed. A value is copied only where the new name has none, once per
 * user and once per workspace, so a setting changed back afterwards stays as
 * it is. The old entries are left for the other extension and can be removed.
 */
export async function migrateContinueSettings(
  context: vscode.ExtensionContext,
): Promise<number> {
  const keys = contributedSettingKeys(context.extension.packageJSON);
  const config = vscode.workspace.getConfiguration();
  const scopes: Array<[Scope, vscode.Memento, string]> = [
    [USER, context.globalState, GLOBAL_DONE_KEY],
  ];
  if (vscode.workspace.workspaceFolders?.length) {
    scopes.push([WORKSPACE, context.workspaceState, WORKSPACE_DONE_KEY]);
  }
  let copied = 0;
  for (const [scope, memento, doneKey] of scopes) {
    if (memento.get(doneKey)) continue;
    for (const key of keys) {
      const oldKey = OLD_PREFIX + key.slice(NEW_PREFIX.length);
      const oldValue = scope.pick(config.inspect(oldKey));
      if (oldValue === undefined) continue;
      if (scope.pick(config.inspect(key)) !== undefined) continue;
      try {
        await config.update(key, oldValue, scope.target);
        copied++;
      } catch (error) {
        console.warn(`Could not copy ${oldKey} to ${key}`, error);
      }
    }
    await memento.update(doneKey, true);
  }
  return copied;
}
