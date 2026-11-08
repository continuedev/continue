import * as vscode from "vscode";

/**
 * An entry this extension wrote in an earlier version: the config schema
 * inside one of its install folders (b1tninja.continued, .continuing or
 * .continuous, any version). Other extensions' entries never match.
 */
const OWN_ENTRY =
  /[/\\]b1tninja\.contin(ued|uing|uous)-[^/\\]+[/\\]config-yaml-schema\.json$/i;

/** `schemas` without this extension's old entries, and how many went. */
export function withoutStaleEntries(schemas: Record<string, unknown>): {
  schemas: Record<string, unknown>;
  removed: number;
} {
  const kept: Record<string, unknown> = {};
  let removed = 0;
  for (const [key, value] of Object.entries(schemas)) {
    let path = key;
    try {
      path = decodeURIComponent(key);
    } catch {
      // keep the raw key
    }
    if (OWN_ENTRY.test(path)) {
      removed++;
    } else {
      kept[key] = value;
    }
  }
  return { schemas: kept, removed };
}

/**
 * Remove the entries earlier versions put in the user's yaml.schemas. The
 * setting is written only when there is something to remove.
 */
export async function removeStaleYamlSchemaEntries(): Promise<number> {
  const yaml = vscode.workspace.getConfiguration("yaml");
  const current = yaml.inspect<Record<string, unknown>>("schemas")?.globalValue;
  if (!current || typeof current !== "object") {
    return 0;
  }
  const { schemas, removed } = withoutStaleEntries(current);
  if (removed > 0) {
    await yaml.update(
      "schemas",
      Object.keys(schemas).length ? schemas : undefined,
      vscode.ConfigurationTarget.Global,
    );
  }
  return removed;
}
