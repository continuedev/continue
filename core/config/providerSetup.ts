import type { ConfigYaml } from "@continuedev/config-yaml";

import type { JSONModelDescription } from "..";
import fs from "node:fs";

import * as YAML from "yaml";

import { editConfigFile, getConfigYamlPath } from "../util/paths";
import { isValidSecretName } from "../util/unresolvedSecrets";

import { defaultSecretName } from "./providerSecretName";
import { modelDescriptionToYamlModel } from "./util";

export { defaultSecretName };

/**
 * Setting up a provider from the GUI: one provider connection (provider plus
 * endpoint, region or profile), several models, one place for the key.
 *
 * Nothing here ever returns a key, and a key value never reaches config.yaml
 * unless the user explicitly chose the "inline" storage.
 */

/** Where the key for a connection lives. */
export type KeyStorage = "secure" | "env" | "envVar" | "inline";

/** What tells two endpoints of the same provider apart. */
export interface ProviderConnectionKey {
  apiBase?: string;
  region?: string;
  profile?: string;
}

export interface ProviderSetupModel {
  /** The `name` in config.yaml (shown in the picker). */
  name: string;
  /** The provider's model id. */
  model: string;
}

export interface ProviderSetupConnection {
  provider: string;
  connection: ProviderConnectionKey;
  models: ProviderSetupModel[];
  /**
   * Whether a key is set up, never the key itself. "secret" means the entry
   * refers to `${{ secrets.NAME }}`; the name is given in `secretName`.
   */
  key: { state: "none" | "inline" | "secret"; secretName?: string };
}

export interface ProviderSetupInfo {
  connections: ProviderSetupConnection[];
  secureStorageAvailable: boolean;
  /** Last storage the user chose, or the default for this editor. */
  preferredKeyStorage: "secure" | "env";
  /** False when there is no config.yaml to edit (config.json users). */
  editable: boolean;
}

export interface SaveProviderModelsRequest {
  provider: string;
  /** Which connection to edit; matches entries by provider and these fields. */
  connection?: ProviderConnectionKey;
  /** Models to add. `apiKey` on them is ignored; use `key`. */
  add?: JSONModelDescription[];
  /** Names (as in config.yaml) of models to remove from this connection. */
  remove?: string[];
  key?: {
    storage: KeyStorage;
    /** Required unless storage is "inline". Must be an environment variable name. */
    secretName?: string;
    /** The key. Omit to keep what is stored and only (re)point the entries. */
    value?: string;
  };
}

export interface SaveProviderModelsResult {
  saved: boolean;
  error?: string;
  warning?: string;
}

const SECRET_REFERENCE =
  /^\s*\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}\s*$/;

export function secretReference(name: string): string {
  return `\${{ secrets.${name} }}`;
}

type YamlModel = Record<string, any>;

function normalizeBase(apiBase: unknown): string {
  return typeof apiBase === "string" ? apiBase.trim().replace(/\/+$/, "") : "";
}

function connectionKeyOf(entry: YamlModel): string {
  return [
    entry.provider ?? "",
    normalizeBase(entry.apiBase),
    entry.env?.region ?? "",
    entry.env?.profile ?? "",
  ].join("|");
}

function requestConnectionKey(
  provider: string,
  c: ProviderConnectionKey | undefined,
): string {
  return [
    provider,
    normalizeBase(c?.apiBase),
    c?.region ?? "",
    c?.profile ?? "",
  ].join("|");
}

function connectionOf(entry: YamlModel): ProviderConnectionKey {
  const connection: ProviderConnectionKey = {};
  const apiBase = normalizeBase(entry.apiBase);
  if (apiBase) connection.apiBase = apiBase;
  if (entry.env?.region) connection.region = entry.env.region;
  if (entry.env?.profile) connection.profile = entry.env.profile;
  return connection;
}

/** The entries written inline in config.yaml (not `uses:` blocks). */
function inlineModels(config: ConfigYaml): YamlModel[] {
  return (config.models ?? []).filter(
    (m: any) => m && typeof m === "object" && typeof m.provider === "string",
  ) as YamlModel[];
}

/** Configured models grouped by provider connection. Never includes a key. */
export function describeProviderConnections(
  config: ConfigYaml,
): ProviderSetupConnection[] {
  const groups = new Map<string, ProviderSetupConnection>();
  for (const entry of inlineModels(config)) {
    const id = connectionKeyOf(entry);
    let group = groups.get(id);
    if (!group) {
      group = {
        provider: entry.provider,
        connection: connectionOf(entry),
        models: [],
        key: { state: "none" },
      };
      groups.set(id, group);
    }
    group.models.push({ name: entry.name, model: entry.model });
    if (group.key.state === "none" && typeof entry.apiKey === "string") {
      const ref = SECRET_REFERENCE.exec(entry.apiKey);
      if (ref) group.key = { state: "secret", secretName: ref[1] };
      else if (entry.apiKey.trim() !== "") group.key = { state: "inline" };
    }
  }
  return [...groups.values()];
}

/** Check a request before anything is written. Returns an error message. */
export function validateSaveRequest(
  req: SaveProviderModelsRequest,
): string | undefined {
  if (!req.provider || typeof req.provider !== "string") {
    return "Choose a provider";
  }
  const key = req.key;
  if (key) {
    if (key.storage === "inline") {
      if (!key.value) return "Enter the key to store it in config.yaml";
    } else {
      if (!key.secretName || !isValidSecretName(key.secretName)) {
        return "The key name must be a valid environment variable name (letters, digits and underscores, not starting with a digit)";
      }
      if (key.storage !== "envVar" && key.value === "") {
        return "The key is empty";
      }
    }
  }
  for (const model of req.add ?? []) {
    if (model.provider !== req.provider) {
      return `${model.title} belongs to a different provider`;
    }
    if (!model.model || !model.title) return "A model needs a name and an id";
  }
  return undefined;
}

function dedupeName(taken: Set<string>, wanted: string): string {
  if (!taken.has(wanted)) return wanted;
  let n = 1;
  while (taken.has(`${wanted} (${n})`)) n++;
  return `${wanted} (${n})`;
}

/** Drop removed model names from `modeModels`, keeping each mode consistent. */
export function removeFromModeModels(
  config: ConfigYaml,
  names: string[],
): ConfigYaml {
  const modeModels = (config as any).modeModels as
    Record<string, any> | undefined;
  if (!modeModels || names.length === 0) return config;
  const gone = new Set(names);

  const next: Record<string, any> = {};
  for (const [mode, entry] of Object.entries(modeModels)) {
    if (!entry || typeof entry !== "object") {
      next[mode] = entry;
      continue;
    }
    const kept: string[] | undefined = Array.isArray(entry.models)
      ? entry.models.filter((n: string) => !gone.has(n))
      : undefined;
    const updated: Record<string, any> = { ...entry };
    if (kept) {
      if (kept.length > 0) updated.models = kept;
      else delete updated.models;
    }
    if (typeof updated.model === "string" && gone.has(updated.model)) {
      // The default went away: the first model still offered takes over.
      if (kept && kept.length > 0) updated.model = kept[0];
      else delete updated.model;
    }
    if (updated.model === undefined && !(updated.models?.length > 0)) {
      continue; // nothing left to offer for this mode
    }
    next[mode] = updated;
  }

  const result: Record<string, any> = { ...config };
  if (Object.keys(next).length > 0) result.modeModels = next;
  else delete result.modeModels;
  return result as ConfigYaml;
}

/**
 * Apply the setup to a config.yaml object. Entries are matched by provider,
 * model id and connection and merged into, so fields added by hand survive.
 * The key reference or value is written only as the request says.
 */
export function applyProviderModels(
  config: ConfigYaml,
  req: SaveProviderModelsRequest,
): ConfigYaml {
  const connectionId = requestConnectionKey(req.provider, req.connection);
  const models: YamlModel[] = [...((config.models ?? []) as YamlModel[])];
  const inConnection = (m: YamlModel) =>
    m &&
    typeof m === "object" &&
    typeof m.provider === "string" &&
    connectionKeyOf(m) === connectionId;

  // 1. Removals (by name, only inside this connection).
  const removeNames = new Set(req.remove ?? []);
  const removed: string[] = [];
  let remaining = models.filter((m) => {
    if (inConnection(m) && removeNames.has(m.name)) {
      removed.push(m.name);
      return false;
    }
    return true;
  });

  // 2. The apiKey every entry of the connection should now carry.
  const existingKey = remaining.find(
    (m) => inConnection(m) && typeof m.apiKey === "string" && m.apiKey !== "",
  )?.apiKey as string | undefined;
  let apiKey: string | undefined;
  let rewriteExisting = false;
  if (req.key) {
    apiKey =
      req.key.storage === "inline"
        ? req.key.value
        : secretReference(req.key.secretName!);
    rewriteExisting = true;
  } else {
    // New models of an already set up connection share its key.
    apiKey = existingKey;
  }

  if (rewriteExisting) {
    remaining = remaining.map((m) => (inConnection(m) ? { ...m, apiKey } : m));
  }

  // 3. Additions.
  const taken = new Set(remaining.map((m) => m?.name).filter(Boolean));
  for (const description of req.add ?? []) {
    const incoming = modelDescriptionToYamlModel({
      ...description,
      apiKey: undefined,
    }) as YamlModel;
    const already = remaining.find(
      (m) => inConnection(m) && m.model === incoming.model,
    );
    if (already) continue; // merged: key handled above
    incoming.name = dedupeName(taken, incoming.name);
    taken.add(incoming.name);
    if (apiKey) incoming.apiKey = apiKey;
    remaining.push(incoming);
  }

  const next = { ...config, models: remaining } as ConfigYaml;
  return removeFromModeModels(next, removed);
}

/**
 * Write the setup to the global config.yaml (comments and key order are kept).
 * Returns false when there is no config.yaml to edit.
 */
export function saveProviderModels(req: SaveProviderModelsRequest): boolean {
  let edited = false;
  editConfigFile(
    (config) => config, // config.json is not edited
    (config) => {
      edited = true;
      return applyProviderModels(config, req);
    },
  );
  return edited;
}

/** The connections in the global config.yaml, or none when there is no file. */
export function readProviderConnections(): {
  connections: ProviderSetupConnection[];
  editable: boolean;
} {
  try {
    const file = getConfigYamlPath();
    if (!fs.existsSync(file)) return { connections: [], editable: false };
    const parsed = YAML.parse(fs.readFileSync(file, "utf8"));
    return {
      connections: describeProviderConnections(
        parsed && typeof parsed === "object" ? parsed : {},
      ),
      editable: true,
    };
  } catch {
    return { connections: [], editable: false };
  }
}
