import * as fs from "fs";
import * as path from "path";

import {
  CatalogModel,
  modelsFileSchema,
  ProviderInstance,
  providersFileSchema,
} from "@continuedev/config-yaml";
import * as YAML from "yaml";

import { env } from "./env.js";
import { logger } from "./util/logger.js";

function readYaml(file: string): unknown {
  if (!fs.existsSync(file)) return undefined;
  try {
    return YAML.parse(fs.readFileSync(file, "utf8")) ?? {};
  } catch (e) {
    logger.warn(`Could not read ${file}: ${(e as Error).message}`);
    return undefined;
  }
}

/** ~/.continue first, then the working directory's .continue/, which wins. */
function candidateFiles(name: string, cwd: string): string[] {
  const global = path.join(env.continueHome, name);
  const local = path.join(cwd, ".continue", name);
  return path.resolve(global) === path.resolve(local)
    ? [global]
    : [global, local];
}

/**
 * The provider accounts (providers.yaml) and model catalog (models.yaml) the
 * IDE uses, so a config's `connection:` and `from:` models work in `cn` too.
 * A later file's entry replaces an earlier one with the same name. A file
 * that does not parse is skipped with a warning.
 */
export function loadLocalModelFiles(cwd: string = process.cwd()): {
  providers: ProviderInstance[];
  catalog: CatalogModel[];
} {
  const providers = new Map<string, ProviderInstance>();
  for (const file of candidateFiles("providers.yaml", cwd)) {
    const raw = readYaml(file);
    if (raw === undefined) continue;
    const parsed = providersFileSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`${file} is not valid; its providers were skipped`);
      continue;
    }
    for (const p of parsed.data.providers) providers.set(p.name, p);
  }

  const catalog = new Map<string, CatalogModel>();
  for (const file of candidateFiles("models.yaml", cwd)) {
    const raw = readYaml(file);
    if (raw === undefined) continue;
    const parsed = modelsFileSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`${file} is not valid; its models were skipped`);
      continue;
    }
    for (const m of parsed.data.models) {
      if (!m.name.includes("#")) catalog.set(m.name, m);
    }
  }

  return {
    providers: Array.from(providers.values()),
    catalog: Array.from(catalog.values()),
  };
}
