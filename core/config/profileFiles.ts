import * as fs from "node:fs";

import { IDE } from "..";
import { getGlobalFolderWithName } from "../util/paths";
import { localPathToUri } from "../util/pathToUri";
import { joinPathsToUri } from "../util/uri";
import { editYamlText } from "../util/yamlEdit";
import { WORKSPACE_DIR } from "../util/workspaceDirs";

/** Where new configs go, in ~/.continuous or the workspace's .continuous. */
export const CONFIGS_DIR_NAME = "configs";

export type ConfigLocation = "global" | "workspace";

/** A new config: no keys of its own; models name a provider instance. */
export function newConfigTemplate(name: string): string {
  return `# ${name}
# Models here can use a provider from providers.yaml with \`connection:\`,
# so this file needs no API keys. See docs/customize/providers.mdx.
name: ${JSON.stringify(name)}
version: 1.0.0
schema: v1

models: []
# models:
#   - name: Claude Sonnet
#     connection: anthropic-work   # a provider instance in providers.yaml
#     model: claude-sonnet-4-6
#     roles: [chat, edit, apply]
#   - name: Qwen (local)
#     provider: ollama
#     model: qwen2.5-coder:7b
#     roles: [autocomplete]
`;
}

/** A file name for a config name: lower case, dashes, at most 60 chars. */
export function configFileSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "config";
}

/** Set the `name:` of a config's YAML, keeping its comments. */
export function setConfigName(content: string, name: string): string {
  const { text, error } = editYamlText<Record<string, unknown>>(
    content,
    (config) => ({ ...config, name }),
  );
  if (error) throw new Error(`The config could not be read: ${error}`);
  return text ?? content;
}

export function validateConfigName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Give the config a name.";
  if (trimmed.length > 100) return "Use a name of at most 100 characters.";
  if (/[\r\n]/.test(trimmed)) return "The name must be on one line.";
  return undefined;
}

async function configsDirUri(
  ide: IDE,
  location: ConfigLocation,
): Promise<string> {
  if (location === "global") {
    const dir = getGlobalFolderWithName(CONFIGS_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return localPathToUri(dir);
  }
  const workspaceDirs = await ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error("Open a folder to save a config in the workspace.");
  }
  return joinPathsToUri(workspaceDirs[0], WORKSPACE_DIR, CONFIGS_DIR_NAME);
}

async function freeFileUri(
  ide: IDE,
  dirUri: string,
  slug: string,
  except?: string,
): Promise<string> {
  for (let i = 0; ; i++) {
    const uri = joinPathsToUri(dirUri, `${slug}${i === 0 ? "" : `-${i}`}.yaml`);
    if (uri === except || !(await ide.fileExists(uri))) return uri;
  }
}

/** Write a new config file and return its URI (which is its profile id). */
export async function createConfigFile(
  ide: IDE,
  opts: { name: string; location: ConfigLocation; content?: string },
): Promise<string> {
  const name = opts.name.trim();
  const dir = await configsDirUri(ide, opts.location);
  const uri = await freeFileUri(ide, dir, configFileSlug(name));
  const content =
    opts.content === undefined
      ? newConfigTemplate(name)
      : setConfigName(opts.content, name);
  await ide.writeFile(uri, content);
  return uri;
}

/**
 * Rename a config: its `name:` and, with `moveFile`, the file itself (to
 * the new name's slug, in the same folder). Returns the config's new URI.
 */
export async function renameConfigFile(
  ide: IDE,
  uri: string,
  name: string,
  opts: { moveFile: boolean },
): Promise<string> {
  const content = await ide.readFile(uri);
  const next = setConfigName(content, name.trim());
  if (!opts.moveFile) {
    if (next !== content) await ide.writeFile(uri, next);
    return uri;
  }
  const dir = uri.slice(0, uri.lastIndexOf("/"));
  const target = await freeFileUri(ide, dir, configFileSlug(name), uri);
  await ide.writeFile(target, next);
  if (target !== uri) await ide.removeFile(uri);
  return target;
}
