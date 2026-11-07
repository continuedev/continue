import * as fs from "node:fs";

import type { ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";

import type { JSONModelDescription } from "../..";
import {
  editConfigFile,
  getEditableConfigYamlPath,
  setConfigFilePermissions,
} from "../../util/paths";
import { editYamlText } from "../../util/yamlEdit";
import {
  ProviderConnectionKey,
  removeFromModeModels,
  SaveProviderModelsRequest,
  secretReference,
} from "../providerSetup";
import { modelDescriptionToYamlModel } from "../util";
import { getGlobalModelsPath } from "./modelsFile";
import { getGlobalProvidersPath } from "./providersFile";

/**
 * Setup that writes reusable pieces instead of copies: the connection as a
 * provider account (providers.yaml), each model once in the catalog
 * (models.yaml) naming that account, and the config only a `from:` entry.
 * Configs set up the old way (models with their own provider, apiBase and
 * key) keep working and are edited as before.
 */

type Doc = Record<string, any>;
type Entry = Record<string, any>;

const MODELS_FILE_HEADER = `# The model catalog: each model once, with the account (providers.yaml) that
# serves it. Configs use a model with \`from: <name>\` or \`from: <name>#<variant>\`.
`;
const PROVIDERS_FILE_HEADER = `# Provider instances: one entry per account or endpoint. Models in any
# config use one with \`connection: <name>\`. Keep keys out of this file:
# use \${{ secrets.NAME }} (the GUI stores keys in secure storage).
`;

const normalizeBase = (apiBase: unknown) =>
  typeof apiBase === "string" ? apiBase.trim().replace(/\/+$/, "") : "";

/** Account names: letters, digits, dots, dashes and underscores. */
export function accountNameFor(
  provider: string,
  connection: ProviderConnectionKey = {},
  preferred?: string,
): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  if (preferred && slug(preferred)) return slug(preferred).slice(0, 64);
  let where = "";
  if (connection.apiBase) {
    try {
      const url = new URL(connection.apiBase);
      where = url.port ? `${url.hostname}-${url.port}` : url.hostname;
    } catch {
      where = connection.apiBase;
    }
  } else if (connection.region) {
    where = connection.region;
  }
  if (connection.profile)
    where = where ? `${where}-${connection.profile}` : connection.profile;
  return (slug(where ? `${provider}-${where}` : provider) || "provider").slice(
    0,
    64,
  );
}

function sameConnection(
  account: Entry,
  provider: string,
  c: ProviderConnectionKey = {},
): boolean {
  return (
    account.provider === provider &&
    normalizeBase(account.apiBase) === normalizeBase(c.apiBase) &&
    (account.env?.region ?? "") === (c.region ?? "") &&
    (account.env?.profile ?? "") === (c.profile ?? "")
  );
}

/** The account a request saves to: one with that endpoint, or a new one. */
export function findOrAddAccount(
  providers: Entry[],
  req: SaveProviderModelsRequest & { accountName?: string },
): { providers: Entry[]; name: string } {
  const list = [...providers];
  const named = req.accountName
    ? list.find((p) => p?.name === req.accountName)
    : undefined;
  const match =
    named && sameConnection(named, req.provider, req.connection)
      ? named
      : list.find((p) => p && sameConnection(p, req.provider, req.connection));

  let apiKey: string | undefined;
  if (req.key) {
    apiKey =
      req.key.storage === "inline"
        ? req.key.value
        : secretReference(req.key.secretName!);
  }

  if (match) {
    const index = list.indexOf(match);
    if (apiKey) list[index] = { ...match, apiKey };
    return { providers: list, name: match.name };
  }

  const taken = new Set(list.map((p) => p?.name));
  let name = accountNameFor(req.provider, req.connection, req.accountName);
  for (let n = 2; taken.has(name); n++) {
    name = `${accountNameFor(req.provider, req.connection, req.accountName)}-${n}`;
  }
  const account: Entry = { name, provider: req.provider };
  if (req.connection?.apiBase) account.apiBase = req.connection.apiBase;
  const env: Entry = {};
  if (req.connection?.region) env.region = req.connection.region;
  if (req.connection?.profile) env.profile = req.connection.profile;
  if (Object.keys(env).length > 0) account.env = env;
  if (apiKey) account.apiKey = apiKey;
  list.push(account);
  return { providers: list, name };
}

/** Fields that belong to the account, not to a catalog model. */
const CONNECTION_FIELDS = ["provider", "apiKey", "apiBase"];

/**
 * A model description as a catalog entry for `account`: what the model is
 * and what the provider reported (context window, capabilities, options),
 * without the connection fields, which the account holds.
 */
export function catalogEntryFor(
  description: JSONModelDescription,
  account: string,
): Entry {
  const yaml = modelDescriptionToYamlModel({
    ...description,
    apiKey: undefined,
  }) as Entry;
  const entry: Entry = {
    name: yaml.name,
    connection: account,
    model: yaml.model,
  };
  // One variant per reasoning effort the server reported: Name#low, Name#high
  const efforts = (description as { reasoningEfforts?: unknown })
    .reasoningEfforts;
  if (Array.isArray(efforts) && efforts.length > 0) {
    entry.variants = Object.fromEntries(
      efforts
        .filter((e): e is string => typeof e === "string" && /^[\w-]+$/.test(e))
        .map((effort) => [
          effort,
          {
            requestOptions: {
              extraBodyProperties: { reasoning_effort: effort },
            },
          },
        ]),
    );
  }
  for (const [key, value] of Object.entries(yaml)) {
    if (
      value === undefined ||
      key in entry ||
      CONNECTION_FIELDS.includes(key)
    ) {
      continue;
    }
    if (key === "env" && value && typeof value === "object") {
      const { region: _r, profile: _p, ...rest } = value as Entry;
      if (Object.keys(rest).length > 0) entry.env = rest;
      continue;
    }
    entry[key] = value;
  }
  return entry;
}

const isFromEntry = (m: Entry, name: string) =>
  m &&
  typeof m === "object" &&
  (m.from === name || (m.from && m.name === name));

/**
 * Apply an account setup to the three documents. Catalog models already
 * there for the same account and model id are reused (not duplicated);
 * names are made unique within the catalog. The config gets one `from:`
 * entry per added model and loses the entries of removed ones.
 */
export function applyAccountSetup(
  docs: { providers: Doc; models: Doc; config: ConfigYaml },
  req: SaveProviderModelsRequest & { accountName?: string },
): { providers: Doc; models: Doc; config: ConfigYaml; account: string } {
  const { providers, name: account } = findOrAddAccount(
    (docs.providers.providers ?? []) as Entry[],
    req,
  );

  const catalog: Entry[] = [...((docs.models.models ?? []) as Entry[])];
  const taken = new Set(catalog.map((m) => m?.name));
  const addedNames: string[] = [];
  for (const description of req.add ?? []) {
    const existing = catalog.find(
      (m) => m?.connection === account && m.model === description.model,
    );
    if (existing) {
      addedNames.push(existing.name);
      continue;
    }
    const entry = catalogEntryFor(description, account);
    let name = String(entry.name).replace(/#/g, " ");
    for (let n = 1; taken.has(name); n++) name = `${entry.name} (${n})`;
    entry.name = name;
    taken.add(name);
    catalog.push(entry);
    addedNames.push(name);
  }

  const removeNames = new Set(req.remove ?? []);
  let configModels: Entry[] = ((docs.config.models ?? []) as Entry[]).filter(
    (m) =>
      !(
        m &&
        typeof m === "object" &&
        m.from &&
        (removeNames.has(m.from) || removeNames.has(m.name))
      ),
  );
  for (const name of addedNames) {
    if (configModels.some((m) => isFromEntry(m, name))) continue;
    configModels.push({ from: name });
  }

  const config = removeFromModeModels(
    { ...docs.config, models: configModels } as ConfigYaml,
    [...removeNames],
  );
  return {
    providers: { ...docs.providers, providers },
    models: { ...docs.models, models: catalog },
    config,
    account,
  };
}

/** Fields a config entry keeps when its model moves to the catalog. */
const CONFIG_ENTRY_FIELDS = ["roles"];

/**
 * Turn the models of one connection set up the old way (each with its own
 * provider, apiBase and key) into an account, catalog models and `from:`
 * entries. Each model keeps its place in the config, its roles and its
 * name (so modeModels still finds it); everything else moves to the
 * catalog, and the connection (with the key reference) to the account.
 */
export function applyConvertToAccount(
  docs: { providers: Doc; models: Doc; config: ConfigYaml },
  provider: string,
  connection: ProviderConnectionKey,
  accountName?: string,
): {
  providers: Doc;
  models: Doc;
  config: ConfigYaml;
  account: string;
  converted: number;
} {
  const entries = (docs.config.models ?? []) as Entry[];
  const inThisConnection = (m: Entry) =>
    m &&
    typeof m === "object" &&
    typeof m.provider === "string" &&
    !m.from &&
    !m.connection &&
    m.provider === provider &&
    normalizeBase(m.apiBase) === normalizeBase(connection.apiBase) &&
    (m.env?.region ?? "") === (connection.region ?? "") &&
    (m.env?.profile ?? "") === (connection.profile ?? "");
  const moving = entries.filter(inThisConnection);
  const keyRef = moving.find((m) => typeof m.apiKey === "string")?.apiKey;

  const { providers, name: account } = findOrAddAccount(
    (docs.providers.providers ?? []) as Entry[],
    { provider, connection, accountName },
  );
  if (keyRef) {
    const i = providers.findIndex((p) => p?.name === account);
    if (i >= 0 && !providers[i].apiKey) {
      providers[i] = { ...providers[i], apiKey: keyRef };
    }
  }

  const catalog: Entry[] = [...((docs.models.models ?? []) as Entry[])];
  const taken = new Set(catalog.map((m) => m?.name));
  const models = entries.map((m) => {
    if (!inThisConnection(m)) return m;
    const existing = catalog.find(
      (c) => c?.connection === account && c.model === m.model,
    );
    let name = existing?.name;
    if (!name) {
      name = String(m.name ?? m.model).replace(/#/g, " ");
      for (let n = 1; taken.has(name); n++) name = `${m.name} (${n})`;
      taken.add(name);
      const entry: Entry = { name, connection: account };
      for (const [key, value] of Object.entries(m)) {
        if (key === "name" || CONFIG_ENTRY_FIELDS.includes(key)) continue;
        if (CONNECTION_FIELDS.includes(key)) continue;
        if (key === "env" && value && typeof value === "object") {
          const { region: _r, profile: _p, ...rest } = value as Entry;
          if (Object.keys(rest).length > 0) entry.env = rest;
          continue;
        }
        entry[key] = value;
      }
      catalog.push(entry);
    }
    const ref: Entry = { from: name };
    if (m.name !== undefined && m.name !== name) ref.name = m.name;
    for (const key of CONFIG_ENTRY_FIELDS) {
      if (m[key] !== undefined) ref[key] = m[key];
    }
    return ref;
  });

  return {
    providers: { ...docs.providers, providers },
    models: { ...docs.models, models: catalog },
    config: { ...docs.config, models } as ConfigYaml,
    account,
    converted: moving.length,
  };
}

/** applyConvertToAccount on the files: account and catalog first. */
export function convertConnectionToAccount(
  provider: string,
  connection: ProviderConnectionKey,
  accountName?: string,
): { account?: string; converted: number } {
  const configPath = getEditableConfigYamlPath();
  if (!configPath) return { converted: 0 };
  const parse = (s: string | undefined): Doc => {
    const v = s ? YAML.parse(s) : undefined;
    return v && typeof v === "object" ? v : {};
  };
  const planned = applyConvertToAccount(
    {
      providers: parse(readDoc(getGlobalProvidersPath())),
      models: parse(readDoc(getGlobalModelsPath())),
      config: parse(readDoc(configPath)) as ConfigYaml,
    },
    provider,
    connection,
    accountName,
  );
  if (planned.converted === 0) return { converted: 0 };
  editFile(
    getGlobalProvidersPath(),
    PROVIDERS_FILE_HEADER,
    "providers: []\n",
    () => planned.providers,
  );
  editFile(
    getGlobalModelsPath(),
    MODELS_FILE_HEADER,
    "models: []\n",
    () => planned.models,
  );
  editConfigFile(
    (config) => config,
    (config) =>
      applyConvertToAccount(
        { providers: planned.providers, models: planned.models, config },
        provider,
        connection,
        accountName,
      ).config,
  );
  return { account: planned.account, converted: planned.converted };
}

function readDoc(file: string): string | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

function editFile(
  file: string,
  header: string,
  empty: string,
  callback: (doc: Doc) => Doc,
): void {
  const source = readDoc(file);
  const base =
    source === undefined || source.trim() === "" ? `${header}${empty}` : source;
  const { text, error } = editYamlText<Doc>(base, callback);
  if (error) throw new Error(`${file} could not be read: ${error}`);
  const next = text ?? (source === undefined ? base : undefined);
  if (next === undefined) return;
  fs.writeFileSync(file, next);
  setConfigFilePermissions(file);
}

/**
 * Save a setup as an account, catalog models and `from:` entries. The key,
 * if any, must already be stored; the request carries only its reference.
 * Returns the account's name, or undefined when the selected config is not
 * a local YAML file.
 */
export function saveProviderModelsToAccount(
  req: SaveProviderModelsRequest & { accountName?: string },
): string | undefined {
  const configPath = getEditableConfigYamlPath();
  if (!configPath) return undefined;
  const parse = (s: string | undefined): Doc => {
    const v = s ? YAML.parse(s) : undefined;
    return v && typeof v === "object" ? v : {};
  };

  // The account and the catalog are written first, so the config never
  // names an account or a model that is not there. Applying the same
  // request again finds them, so the config edit below adds only its part.
  const planned = applyAccountSetup(
    {
      providers: parse(readDoc(getGlobalProvidersPath())),
      models: parse(readDoc(getGlobalModelsPath())),
      config: parse(readDoc(configPath)) as ConfigYaml,
    },
    req,
  );
  editFile(
    getGlobalProvidersPath(),
    PROVIDERS_FILE_HEADER,
    "providers: []\n",
    () => planned.providers,
  );
  editFile(
    getGlobalModelsPath(),
    MODELS_FILE_HEADER,
    "models: []\n",
    () => planned.models,
  );

  let account: string | undefined;
  editConfigFile(
    (config) => config, // config.json is not edited
    (config) => {
      const result = applyAccountSetup(
        { providers: planned.providers, models: planned.models, config },
        req,
      );
      account = result.account;
      return result.config;
    },
  );
  return account;
}
