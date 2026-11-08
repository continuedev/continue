import type { ConfigYaml } from "@continuedev/config-yaml";

import type { JSONModelDescription } from "..";
import fs from "node:fs";

import * as YAML from "yaml";

import { editConfigFile, getEditableConfigYamlPath } from "../util/paths";
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
  /**
   * The provider account (providers.yaml) these models use, when they were
   * set up as catalog models (`from:`) or name it with `connection:`.
   * Absent for models with their own provider, apiBase and key.
   */
  account?: string;
  models: ProviderSetupModel[];
  /**
   * Whether a key is set up, never the key itself. "secret" means the entry
   * refers to `${{ secrets.NAME }}`; the name is given in `secretName`.
   */
  key: {
    state: "none" | "inline" | "secret";
    secretName?: string;
    /**
     * Where the secret's value is found on this machine, filled in by core
     * (not by `describeProviderConnections`). Never the value itself.
     */
    storedIn?: { secure: boolean; env: boolean };
  };
}

export interface ProviderSetupInfo {
  connections: ProviderSetupConnection[];
  secureStorageAvailable: boolean;
  /** Last storage the user chose, or the default for this editor. */
  preferredKeyStorage: "secure" | "env";
  /** False when the selected config is not a local YAML file. */
  editable: boolean;
}

export interface SaveProviderModelsRequest {
  provider: string;
  /**
   * The connection after this save; entries are matched by provider and these
   * fields. Without `from`, this is also the connection being edited.
   */
  connection?: ProviderConnectionKey;
  /**
   * Editing a connection's apiBase, region or profile: the connection as it is
   * in config.yaml now. Its entries are changed in place to `connection`
   * (they keep their names, comments and every other field) rather than a new
   * connection being created beside them.
   */
  from?: ProviderConnectionKey;
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
  /**
   * Save as a provider account (providers.yaml) with catalog models
   * (models.yaml) and `from:` entries, instead of models that carry their
   * own connection. `name` is the account name to use for a new account.
   */
  account?: { name?: string };
}

export interface SaveProviderModelsResult {
  saved: boolean;
  error?: string;
  warning?: string;
  /**
   * The key went to secure storage, and ~/.continuous/.env still has a plaintext
   * copy under this name. The GUI offers to remove it (`config/removeEnvSecret`).
   */
  envShadowedSecret?: string;
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
  if (req.from && !req.connection) {
    return "Say which endpoint the connection should use";
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

/** Thrown when an edit cannot be applied; the message is safe to show. */
export class ProviderSetupError extends Error {}

/**
 * Point the entries of the `from` connection at `to`. Only apiBase and
 * env.region / env.profile change, and only when they differ, so a hand-written
 * trailing slash or a comment on an untouched field survives.
 */
function moveConnection(
  models: YamlModel[],
  provider: string,
  from: ProviderConnectionKey,
  to: ProviderConnectionKey | undefined,
): YamlModel[] {
  const fromId = requestConnectionKey(provider, from);
  const toId = requestConnectionKey(provider, to);
  if (fromId === toId) return models;

  if (
    models.some(
      (m) => m && typeof m === "object" && connectionKeyOf(m) === toId,
    )
  ) {
    throw new ProviderSetupError(
      "Another connection to that endpoint already exists. Edit that one instead, or remove its models first.",
    );
  }

  return models.map((m) => {
    if (!m || typeof m !== "object" || connectionKeyOf(m) !== fromId) return m;
    const next: YamlModel = { ...m };

    if (normalizeBase(m.apiBase) !== normalizeBase(to?.apiBase)) {
      if (to?.apiBase) next.apiBase = to.apiBase;
      else delete next.apiBase;
    }

    const env: Record<string, any> = { ...(m.env ?? {}) };
    for (const field of ["region", "profile"] as const) {
      if ((m.env?.[field] ?? "") === (to?.[field] ?? "")) continue;
      if (to?.[field]) env[field] = to[field];
      else delete env[field];
    }
    if (Object.keys(env).length > 0) next.env = env;
    else delete next.env;
    return next;
  });
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
  let models: YamlModel[] = [...((config.models ?? []) as YamlModel[])];
  if (req.from) {
    models = moveConnection(models, req.provider, req.from, req.connection);
  }
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
 * Write the setup to the selected config (comments and key order are kept).
 * Returns false when it is not a YAML file this can edit.
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

/**
 * Configured models that use a provider account, grouped by account: the
 * config's `from:` entries (through the catalog) and `connection:` entries.
 */
export function describeAccountConnections(
  config: ConfigYaml,
  accounts: YamlModel[],
  catalog: YamlModel[],
): ProviderSetupConnection[] {
  const byAccount = new Map(accounts.map((a) => [a?.name, a]));
  const byModel = new Map(catalog.map((m) => [m?.name, m]));
  const groups = new Map<string, ProviderSetupConnection>();
  for (const entry of (config.models ?? []) as YamlModel[]) {
    if (!entry || typeof entry !== "object") continue;
    let accountName: string | undefined;
    let modelId: string | undefined;
    let shown: string | undefined;
    if (typeof entry.from === "string") {
      const base = byModel.get(entry.from.split("#")[0]);
      accountName = entry.connection ?? base?.connection;
      modelId = entry.model ?? base?.model;
      shown = entry.name ?? entry.from;
    } else if (typeof entry.connection === "string") {
      accountName = entry.connection;
      modelId = entry.model;
      shown = entry.name;
    }
    const account = accountName ? byAccount.get(accountName) : undefined;
    if (!account || !modelId || !shown) continue;
    let group = groups.get(account.name);
    if (!group) {
      const ref =
        typeof account.apiKey === "string"
          ? SECRET_REFERENCE.exec(account.apiKey)
          : null;
      group = {
        provider: account.provider,
        connection: connectionOf(account),
        account: account.name,
        models: [],
        key: ref
          ? { state: "secret", secretName: ref[1] }
          : typeof account.apiKey === "string" && account.apiKey.trim() !== ""
            ? { state: "inline" }
            : { state: "none" },
      };
      groups.set(account.name, group);
    }
    group.models.push({ name: shown, model: modelId });
  }
  return [...groups.values()];
}

function readYamlList(file: string, key: string): YamlModel[] {
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = YAML.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed?.[key]) ? parsed[key] : [];
  } catch {
    return [];
  }
}

/** The connections in the selected config, or none when it cannot be edited. */
export function readProviderConnections(paths?: {
  providers: string;
  models: string;
}): {
  connections: ProviderSetupConnection[];
  editable: boolean;
} {
  try {
    const file = getEditableConfigYamlPath();
    if (!file) return { connections: [], editable: false };
    const parsed = YAML.parse(fs.readFileSync(file, "utf8"));
    const config = parsed && typeof parsed === "object" ? parsed : {};
    return {
      connections: [
        ...describeProviderConnections(config),
        ...(paths
          ? describeAccountConnections(
              config,
              readYamlList(paths.providers, "providers"),
              readYamlList(paths.models, "models"),
            )
          : []),
      ],
      editable: true,
    };
  } catch {
    return { connections: [], editable: false };
  }
}
