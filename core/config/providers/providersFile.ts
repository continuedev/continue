import * as fs from "node:fs";
import * as path from "node:path";

import {
  ConfigValidationError,
  ProviderInstance,
  providersFileSchema,
} from "@continuedev/config-yaml";
import * as YAML from "yaml";

import { IDE } from "../..";
import { getContinueGlobalPath } from "../../util/paths";
import { localPathToUri } from "../../util/pathToUri";
import { joinPathsToUri } from "../../util/uri";
import { WORKSPACE_DIRS } from "../../util/workspaceDirs";

export const PROVIDERS_FILE_NAME = "providers.yaml";

/** ~/.continuous/providers.yaml: the provider instances every config can use. */
export function getGlobalProvidersPath(): string {
  return path.join(getContinueGlobalPath(), PROVIDERS_FILE_NAME);
}

/** Parse a providers file. A bad file yields no instances and an error. */
export function parseProvidersFile(
  content: string,
  source: string,
): { providers: ProviderInstance[]; errors: ConfigValidationError[] } {
  if (content.trim() === "") return { providers: [], errors: [] };
  let raw: unknown;
  try {
    raw = YAML.parse(content);
  } catch (e) {
    return {
      providers: [],
      errors: [
        {
          fatal: false,
          message: `Could not read ${source}: ${e instanceof Error ? e.message : String(e)}`,
          uri: source,
        },
      ],
    };
  }
  const result = providersFileSchema.safeParse(raw ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      providers: [],
      errors: [
        {
          fatal: false,
          message: `${source} is not valid: ${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "invalid"}`,
          uri: source,
        },
      ],
    };
  }

  const errors: ConfigValidationError[] = [];
  const seen = new Set<string>();
  const providers: ProviderInstance[] = [];
  for (const p of result.data.providers) {
    if (seen.has(p.name)) {
      errors.push({
        fatal: false,
        message: `${source} defines the provider "${p.name}" twice; the first one is used.`,
        uri: source,
      });
      continue;
    }
    seen.add(p.name);
    providers.push(p);
  }
  return { providers, errors };
}

/**
 * Provider instances for loading a config: ~/.continuous/providers.yaml, then
 * each workspace's .continuous/providers.yaml. A workspace instance with the
 * same name replaces the global one, like the workspace's configs do.
 */
export async function loadProviderInstances(
  ide: IDE,
): Promise<{ providers: ProviderInstance[]; errors: ConfigValidationError[] }> {
  const errors: ConfigValidationError[] = [];
  const byName = new Map<string, ProviderInstance>();

  const add = (content: string, source: string) => {
    const parsed = parseProvidersFile(content, source);
    errors.push(...parsed.errors);
    for (const p of parsed.providers) byName.set(p.name, p);
  };

  const globalPath = getGlobalProvidersPath();
  if (fs.existsSync(globalPath)) {
    add(fs.readFileSync(globalPath, "utf8"), localPathToUri(globalPath));
  }

  for (const file of await readWorkspaceProvidersFiles(ide)) {
    add(file.content, file.uri);
  }

  return { providers: Array.from(byName.values()), errors };
}

/** Each workspace's .continuous/providers.yaml (and older .continue/providers.yaml) that exists, read. */
export async function readWorkspaceProvidersFiles(
  ide: IDE,
): Promise<{ uri: string; label: string; content: string }[]> {
  const files: { uri: string; label: string; content: string }[] = [];
  try {
    const uris = (await ide.getWorkspaceDirs()).flatMap((dir) =>
      // The older .continue first, so .continuous wins on a shared name
      [...WORKSPACE_DIRS]
        .reverse()
        .map((name) => joinPathsToUri(dir, name, PROVIDERS_FILE_NAME)),
    );
    for (const uri of uris) {
      if (await ide.fileExists(uri)) {
        files.push({
          uri,
          label: `${PROVIDERS_FILE_NAME} (workspace)`,
          content: await ide.readFile(uri),
        });
      }
    }
  } catch (e) {
    console.warn("Could not read workspace providers.yaml", e);
  }
  return files;
}
