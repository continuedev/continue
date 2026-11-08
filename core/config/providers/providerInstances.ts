import * as fs from "node:fs";

import { providerInstanceSchema } from "@continuedev/config-yaml";
import * as YAML from "yaml";

import { IDE } from "../..";
import { setConfigFilePermissions } from "../../util/paths";
import { localPathToUri } from "../../util/pathToUri";
import { readSecretFromEnvFile } from "../../util/secretsFile";
import { isValidSecretName } from "../../util/unresolvedSecrets";
import { editYamlText } from "../../util/yamlEdit";
import { defaultSecretName } from "../providerSecretName";
import { secretReference } from "../providerSetup";
import { SecretStorageKind, storeSecret } from "../secretStorage";
import { getGlobalProvidersPath, parseProvidersFile } from "./providersFile";
import {
  looksLikePlaceholderKey,
  MovePlaintextKeysResult,
  PlaintextKey,
  ProviderInstanceInfo,
  ProviderInstancesInfo,
  ProviderKeyState,
  SaveProviderInstanceRequest,
  SaveProviderInstanceResult,
} from "./types";

/** A local config or providers file, read for scanning. */
export interface ConfigFileContent {
  uri: string;
  /** What the user calls it, e.g. "Main Config" or "providers.yaml". */
  label: string;
  content: string;
}

const SECRET_REF = /^\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/;

const PROVIDERS_FILE_HEADER = `# Provider instances: one entry per account or endpoint. Models in any
# config use one with \`connection: <name>\`. Keep keys out of this file:
# use \${{ secrets.NAME }} (the GUI stores keys in secure storage).
`;

export function describeKey(apiKey: unknown): ProviderKeyState {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return { state: "none" };
  }
  const ref = apiKey.trim().match(SECRET_REF);
  if (ref) return { state: "secret", secretName: ref[1] };
  return { state: "inline" };
}

function parseYaml(content: string): Record<string, any> | undefined {
  try {
    const parsed = YAML.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/** Which models in which configs use each instance name. */
function connectionUsage(
  configFiles: ConfigFileContent[],
): Map<string, { config: string; model: string }[]> {
  const usage = new Map<string, { config: string; model: string }[]>();
  for (const file of configFiles) {
    const models = parseYaml(file.content)?.models;
    if (!Array.isArray(models)) continue;
    for (const m of models) {
      if (!m || typeof m !== "object" || typeof m.connection !== "string") {
        continue;
      }
      const list = usage.get(m.connection) ?? [];
      list.push({ config: file.label, model: String(m.name ?? m.model ?? "") });
      usage.set(m.connection, list);
    }
  }
  return usage;
}

async function keyPresence(
  ide: Pick<IDE, "readSecrets">,
  names: string[],
  opts: { continueDir: string; secureStorageAvailable: boolean },
): Promise<Map<string, { secure: boolean; env: boolean }>> {
  let secure: Record<string, string> = {};
  if (names.length > 0 && opts.secureStorageAvailable) {
    try {
      secure = (await ide.readSecrets(names)) ?? {};
    } catch {
      secure = {};
    }
  }
  return new Map(
    names.map((n) => [
      n,
      {
        secure: !!secure[n],
        env: !!readSecretFromEnvFile(opts.continueDir, n),
      },
    ]),
  );
}

/**
 * The provider instances in ~/.continuous/providers.yaml and each workspace's
 * .continuous/providers.yaml, with key state (never values) and the models that
 * use them.
 */
export async function listProviderInstances(
  ide: Pick<IDE, "readSecrets">,
  args: {
    workspaceFiles: ConfigFileContent[];
    configFiles: ConfigFileContent[];
    continueDir: string;
    secureStorageAvailable: boolean;
  },
): Promise<ProviderInstancesInfo> {
  const globalPath = getGlobalProvidersPath();
  const globalFileUri = localPathToUri(globalPath);
  const sources: { file: ConfigFileContent; source: "global" | "workspace" }[] =
    [];
  if (fs.existsSync(globalPath)) {
    sources.push({
      file: {
        uri: globalFileUri,
        label: "providers.yaml",
        content: fs.readFileSync(globalPath, "utf8"),
      },
      source: "global",
    });
  }
  for (const file of args.workspaceFiles) {
    sources.push({ file, source: "workspace" });
  }

  const usage = connectionUsage(args.configFiles);
  const instances: ProviderInstanceInfo[] = [];
  for (const { file, source } of sources) {
    // Keys are described from the raw YAML: the parsed instance has the same
    // apiKey string, and nothing here is rendered.
    for (const p of parseProvidersFile(file.content, file.uri).providers) {
      const headers = p.requestOptions?.headers;
      instances.push({
        name: p.name,
        provider: p.provider,
        ...(p.apiBase ? { apiBase: p.apiBase } : {}),
        ...(p.env ? { env: p.env } : {}),
        ...(headers ? { headerNames: Object.keys(headers) } : {}),
        source,
        sourceUri: file.uri,
        key: describeKey(p.apiKey),
        usedBy: usage.get(p.name) ?? [],
      });
    }
  }
  // A workspace instance replaces a global one of the same name.
  const workspaceNames = new Set(
    instances.filter((i) => i.source === "workspace").map((i) => i.name),
  );
  for (const i of instances) {
    if (i.source === "global" && workspaceNames.has(i.name)) {
      i.overridden = true;
    }
  }

  const secretNames = [
    ...new Set(instances.flatMap((i) => i.key.secretName ?? [])),
  ];
  const presence = await keyPresence(ide, secretNames, args);
  for (const i of instances) {
    if (i.key.secretName) i.key.storedIn = presence.get(i.key.secretName);
  }
  return {
    instances,
    globalFileUri,
    secureStorageAvailable: args.secureStorageAvailable,
  };
}

type ProvidersDoc = { providers?: Record<string, unknown>[] };

/** Edit ~/.continuous/providers.yaml, creating it when missing. */
function editGlobalProvidersFile(
  callback: (doc: ProvidersDoc) => ProvidersDoc,
): void {
  const file = getGlobalProvidersPath();
  const source = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : `${PROVIDERS_FILE_HEADER}providers: []\n`;
  const base = source.trim() === "" ? "providers: []\n" : source;
  const { text, error } = editYamlText<ProvidersDoc>(base, callback);
  if (error) throw new Error(`providers.yaml could not be read: ${error}`);
  const next = text ?? (fs.existsSync(file) ? undefined : base);
  if (next === undefined) return;
  fs.writeFileSync(file, next);
  setConfigFilePermissions(file);
}

function validateInstance(
  req: SaveProviderInstanceRequest,
): string | undefined {
  const name = req.name.trim();
  if (!name) return "Give the provider a name.";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    return "Use letters, digits, dots, dashes and underscores for the name (at most 64).";
  }
  if (!req.provider.trim()) return "Choose a provider type.";
  if (req.apiBase && !/^https?:\/\/\S+$/i.test(req.apiBase.trim())) {
    return "The base URL must start with http:// or https://.";
  }
  const key = req.key;
  if (key && key.storage !== "none") {
    const secretName = key.secretName ?? defaultSecretName(name);
    if (!isValidSecretName(secretName)) {
      return `"${secretName}" is not a valid secret name.`;
    }
  }
  const check = providerInstanceSchema.safeParse({
    name,
    provider: req.provider.trim(),
    ...(req.apiBase ? { apiBase: req.apiBase.trim() } : {}),
    ...(req.env ? { env: req.env } : {}),
  });
  if (!check.success) {
    const issue = check.error.issues[0];
    return `${issue?.path.join(".") || "provider"}: ${issue?.message}`;
  }
  return undefined;
}

/**
 * Add or edit an instance in ~/.continuous/providers.yaml. A new key is stored
 * first (secure storage or ~/.continuous/.env) and the file only gets its
 * `${{ secrets.NAME }}` reference. Renaming an instance also renames the
 * `connection:` of the models in `configFiles` that use it.
 */
export async function saveProviderInstance(
  ide: Pick<IDE, "readSecrets" | "writeSecrets" | "writeFile">,
  req: SaveProviderInstanceRequest,
  args: { continueDir: string; configFiles: ConfigFileContent[] },
): Promise<SaveProviderInstanceResult> {
  const invalid = validateInstance(req);
  if (invalid) return { saved: false, error: invalid };
  const name = req.name.trim();

  const existing = parseProvidersFile(
    fs.existsSync(getGlobalProvidersPath())
      ? fs.readFileSync(getGlobalProvidersPath(), "utf8")
      : "",
    "providers.yaml",
  ).providers;
  if (req.previousName && !existing.some((p) => p.name === req.previousName)) {
    return {
      saved: false,
      error: `There is no provider "${req.previousName}" in providers.yaml.`,
    };
  }
  if (name !== req.previousName && existing.some((p) => p.name === name)) {
    return {
      saved: false,
      error: `A provider named "${name}" already exists.`,
    };
  }

  let apiKey: string | null | undefined; // undefined: keep, null: remove
  let envShadowedSecret: string | undefined;
  const key = req.key;
  if (key?.storage === "none") {
    apiKey = null;
  } else if (key) {
    const secretName = key.secretName ?? defaultSecretName(name);
    if (key.value) {
      const stored = await storeSecret({
        ide,
        name: secretName,
        value: key.value,
        storage: key.storage,
        continueDir: args.continueDir,
      });
      if (!stored.stored) {
        return {
          saved: false,
          error: stored.error ?? "Could not store the key",
        };
      }
      if (stored.envShadowed) envShadowedSecret = secretName;
    }
    apiKey = secretReference(secretName);
  }

  editGlobalProvidersFile((doc) => {
    const providers = Array.isArray(doc.providers) ? [...doc.providers] : [];
    const index = req.previousName
      ? providers.findIndex((p) => p?.name === req.previousName)
      : -1;
    const before = index >= 0 ? providers[index] : {};
    const next: Record<string, unknown> = {
      ...before,
      name,
      provider: req.provider.trim(),
      apiBase: req.apiBase?.trim() || undefined,
      env: req.env && Object.keys(req.env).length > 0 ? req.env : undefined,
    };
    if (apiKey === null) delete next.apiKey;
    else if (apiKey !== undefined) next.apiKey = apiKey;
    for (const k of Object.keys(next)) {
      if (next[k] === undefined) delete next[k];
    }
    if (index >= 0) providers[index] = next;
    else providers.push(next);
    return { ...doc, providers };
  });

  let modelsUpdated = 0;
  if (req.previousName && req.previousName !== name) {
    modelsUpdated = await renameConnections(
      ide,
      args.configFiles,
      req.previousName,
      name,
    );
  }
  return {
    saved: true,
    ...(modelsUpdated ? { modelsUpdated } : {}),
    ...(envShadowedSecret ? { envShadowedSecret } : {}),
  };
}

async function renameConnections(
  ide: Pick<IDE, "writeFile">,
  files: ConfigFileContent[],
  from: string,
  to: string,
): Promise<number> {
  let count = 0;
  for (const file of files) {
    let changed = 0;
    const { text } = editYamlText<{ models?: unknown[] }>(
      file.content,
      (config) => {
        if (!Array.isArray(config.models)) return config;
        return {
          ...config,
          models: config.models.map((m: any) => {
            if (m && typeof m === "object" && m.connection === from) {
              changed++;
              return { ...m, connection: to };
            }
            return m;
          }),
        };
      },
    );
    if (text !== undefined && changed > 0) {
      await ide.writeFile(file.uri, text);
      count += changed;
    }
  }
  return count;
}

/** Remove an instance from ~/.continuous/providers.yaml. Its key is kept. */
export function deleteProviderInstance(name: string): {
  deleted: boolean;
  error?: string;
} {
  let found = false;
  try {
    editGlobalProvidersFile((doc) => {
      const providers = Array.isArray(doc.providers) ? doc.providers : [];
      const rest = providers.filter((p) => p?.name !== name);
      found = rest.length !== providers.length;
      return { ...doc, providers: rest };
    });
  } catch (e) {
    return {
      deleted: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  return found
    ? { deleted: true }
    : { deleted: false, error: `There is no provider "${name}".` };
}

/**
 * API keys written as plain text: `apiKey` values in configs' models and in
 * providers files that are not `${{ secrets.NAME }}` references or obvious
 * placeholders. Values are never part of the result.
 */
export function findPlaintextKeys(files: ConfigFileContent[]): PlaintextKey[] {
  const found: PlaintextKey[] = [];
  for (const file of files) {
    const parsed = parseYaml(file.content);
    if (!parsed) continue;
    for (const kind of ["models", "providers"] as const) {
      const list = parsed[kind];
      if (!Array.isArray(list)) continue;
      list.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        const apiKey = entry.apiKey;
        if (typeof apiKey !== "string" || looksLikePlaceholderKey(apiKey)) {
          return;
        }
        const label = String(entry.name ?? entry.model ?? `#${index + 1}`);
        found.push({
          id: `${file.uri}#${kind}.${index}`,
          fileUri: file.uri,
          fileLabel: file.label,
          kind: kind === "models" ? "model" : "provider",
          label,
          secretName: defaultSecretName(
            kind === "providers"
              ? String(entry.name ?? entry.provider ?? "provider")
              : String(entry.provider ?? entry.name ?? "provider"),
          ),
        });
      });
    }
  }
  return found;
}

/**
 * A name to store `value` under: `base` when it is free or already holds the
 * same value, else `base_2`, `base_3`, ...
 */
async function freeSecretName(
  ide: Pick<IDE, "readSecrets">,
  base: string,
  value: string,
  storage: SecretStorageKind,
  continueDir: string,
  taken: Map<string, string>,
): Promise<string> {
  for (let i = 1; i < 100; i++) {
    const name = i === 1 ? base : `${base}_${i}`;
    const planned = taken.get(name);
    if (planned !== undefined) {
      if (planned === value) return name;
      continue;
    }
    let current: string | undefined;
    if (storage === "secure") {
      try {
        current = (await ide.readSecrets([name]))?.[name];
      } catch {
        current = undefined;
      }
    }
    current ??= readSecretFromEnvFile(continueDir, name);
    if (!current || current === value) return name;
  }
  throw new Error(`No free secret name for ${base}`);
}

/**
 * Move the chosen plaintext keys to secure storage (or ~/.continuous/.env) and
 * replace each with a `${{ secrets.NAME }}` reference. A file is rewritten
 * only after every key it gives up has been stored. Values never leave core.
 */
export async function movePlaintextKeys(
  ide: Pick<IDE, "readSecrets" | "writeSecrets" | "readFile" | "writeFile">,
  ids: string[],
  args: { storage: SecretStorageKind; continueDir: string },
): Promise<MovePlaintextKeysResult> {
  const result: MovePlaintextKeysResult = { moved: [], failed: [] };
  const byFile = new Map<
    string,
    { id: string; kind: string; index: number }[]
  >();
  for (const id of ids) {
    const m = id.match(/^(.*)#(models|providers)\.(\d+)$/);
    if (!m) {
      result.failed.push({ id, error: "Unknown key" });
      continue;
    }
    const list = byFile.get(m[1]) ?? [];
    list.push({ id, kind: m[2], index: Number(m[3]) });
    byFile.set(m[1], list);
  }

  const taken = new Map<string, string>();
  for (const [uri, entries] of byFile) {
    let content: string;
    try {
      content = await ide.readFile(uri);
    } catch {
      for (const e of entries) {
        result.failed.push({ id: e.id, error: "The file could not be read" });
      }
      continue;
    }
    const parsed = parseYaml(content);
    const current = findPlaintextKeys([{ uri, label: "", content }]);
    const refs = new Map<string, string>(); // id -> reference
    for (const e of entries) {
      const key = current.find((k) => k.id === e.id);
      const entry = parsed?.[e.kind]?.[e.index];
      const value = entry?.apiKey;
      if (!key || typeof value !== "string") {
        result.failed.push({
          id: e.id,
          error: "The key changed since it was found; check again",
        });
        continue;
      }
      try {
        const name = await freeSecretName(
          ide,
          key.secretName,
          value,
          args.storage,
          args.continueDir,
          taken,
        );
        const stored = await storeSecret({
          ide,
          name,
          value,
          storage: args.storage,
          continueDir: args.continueDir,
        });
        if (!stored.stored) {
          result.failed.push({
            id: e.id,
            error: stored.error ?? "Could not store the key",
          });
          continue;
        }
        taken.set(name, value);
        refs.set(`${e.kind}.${e.index}`, secretReference(name));
      } catch (err) {
        result.failed.push({
          id: e.id,
          error: err instanceof Error ? err.message : "Could not store the key",
        });
      }
    }
    if (refs.size === 0) continue;

    const { text, error } = editYamlText<Record<string, unknown>>(
      content,
      (doc) => {
        const next: Record<string, unknown> = { ...doc };
        for (const kind of ["models", "providers"]) {
          const list = doc[kind];
          if (!Array.isArray(list)) continue;
          next[kind] = list.map((item, index) => {
            const ref = refs.get(`${kind}.${index}`);
            return ref ? { ...item, apiKey: ref } : item;
          });
        }
        return next;
      },
    );
    const movedIds = entries
      .filter((e) => refs.has(`${e.kind}.${e.index}`))
      .map((e) => e.id);
    if (error || text === undefined) {
      for (const id of movedIds) {
        result.failed.push({
          id,
          error: `The key was stored, but the file could not be updated${error ? `: ${error}` : ""}`,
        });
      }
      continue;
    }
    await ide.writeFile(uri, text);
    result.moved.push(...movedIds);
  }
  return result;
}
