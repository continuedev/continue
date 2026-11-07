import * as fs from "node:fs";
import * as path from "node:path";

import {
  CatalogModel,
  ConfigValidationError,
  modelsFileSchema,
} from "@continuedev/config-yaml";
import * as YAML from "yaml";

import { IDE } from "../..";
import { getContinueGlobalPath } from "../../util/paths";
import { localPathToUri } from "../../util/pathToUri";
import { joinPathsToUri } from "../../util/uri";

export const MODELS_FILE_NAME = "models.yaml";

/** ~/.continue/models.yaml: the model catalog every config can use. */
export function getGlobalModelsPath(): string {
  return path.join(getContinueGlobalPath(), MODELS_FILE_NAME);
}

/** Parse a models file. A bad file yields no models and an error. */
export function parseModelsFile(
  content: string,
  source: string,
): { models: CatalogModel[]; errors: ConfigValidationError[] } {
  if (content.trim() === "") return { models: [], errors: [] };
  let raw: unknown;
  try {
    raw = YAML.parse(content);
  } catch (e) {
    return {
      models: [],
      errors: [
        {
          fatal: false,
          message: `Could not read ${source}: ${e instanceof Error ? e.message : String(e)}`,
          uri: source,
        },
      ],
    };
  }
  const result = modelsFileSchema.safeParse(raw ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      models: [],
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
  const models: CatalogModel[] = [];
  for (const m of result.data.models) {
    if (seen.has(m.name)) {
      errors.push({
        fatal: false,
        message: `${source} defines the model "${m.name}" twice; the first one is used.`,
        uri: source,
      });
      continue;
    }
    if (m.name.includes("#")) {
      errors.push({
        fatal: false,
        message: `${source}: the model name "${m.name}" contains "#", which picks a variant. The model was skipped.`,
        uri: source,
      });
      continue;
    }
    seen.add(m.name);
    models.push(m);
  }
  return { models, errors };
}

/**
 * The model catalog for loading a config: ~/.continue/models.yaml, then each
 * workspace's .continue/models.yaml. A workspace model with the same name
 * replaces the global one, as workspace provider accounts do.
 */
export async function loadModelCatalog(
  ide: IDE,
): Promise<{ models: CatalogModel[]; errors: ConfigValidationError[] }> {
  const errors: ConfigValidationError[] = [];
  const byName = new Map<string, CatalogModel>();

  const add = (content: string, source: string) => {
    const parsed = parseModelsFile(content, source);
    errors.push(...parsed.errors);
    for (const m of parsed.models) byName.set(m.name, m);
  };

  const globalPath = getGlobalModelsPath();
  if (fs.existsSync(globalPath)) {
    add(fs.readFileSync(globalPath, "utf8"), localPathToUri(globalPath));
  }

  try {
    for (const dir of await ide.getWorkspaceDirs()) {
      const uri = joinPathsToUri(dir, ".continue", MODELS_FILE_NAME);
      if (await ide.fileExists(uri)) add(await ide.readFile(uri), uri);
    }
  } catch (e) {
    console.warn("Could not read workspace models.yaml", e);
  }

  return { models: Array.from(byName.values()), errors };
}
