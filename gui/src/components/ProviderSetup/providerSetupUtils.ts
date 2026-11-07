import type {
  KeyStorage,
  ProviderConnectionKey,
  ProviderSetupConnection,
  ProviderSetupModel,
  SaveProviderModelsRequest,
} from "core/config/providerSetup";
import { buildModelFromForm, FormValues } from "../../forms/addModelFormUtils";
import type { ModelLists } from "../../forms/modelListUtils";
import type { ModelPackage } from "../../pages/AddNewModel/configs/models";
import type { ProviderInfo } from "../../pages/AddNewModel/configs/providers";
import { fuzzyScore } from "../modelSelection/ModelSelectionListbox";

export type SetupStep = "credentials" | "models" | "review";

/** How many curated "popular" models start checked for a new provider. */
export const DEFAULT_CHECKED_COUNT = 3;

/** One line of the model checklist. */
export interface ChecklistRow {
  /** The provider's model id; the identity used to match configured models. */
  model: string;
  title: string;
  description?: string;
  /** In config.yaml already (so it can be removed). */
  configured: boolean;
  /** Absent for a configured model the provider's list does not offer. */
  pkg?: ModelPackage;
  deprecated?: boolean;
}

export interface ChecklistGroups {
  top: ChecklistRow[];
  other: ChecklistRow[];
  /** Configured models the current list does not include. */
  configuredOnly: ChecklistRow[];
}

function rowOf(pkg: ModelPackage, configured: Set<string>): ChecklistRow {
  return {
    model: pkg.params.model,
    title: pkg.title,
    description: pkg.description,
    configured: configured.has(pkg.params.model),
    pkg,
    deprecated: pkg.deprecated,
  };
}

/**
 * Rows for the checklist: the provider's list, plus configured models it does
 * not offer (a custom id, a model the provider has retired) so that unchecking
 * them is the only way they are removed.
 */
export function buildChecklistRows(
  lists: Pick<ModelLists, "top" | "other">,
  configuredModels: ProviderSetupModel[],
): ChecklistGroups {
  const configured = new Set(configuredModels.map((m) => m.model));
  const top = lists.top.map((p) => rowOf(p, configured));
  const other = (lists.other ?? []).map((p) => rowOf(p, configured));
  const offered = new Set([...top, ...other].map((r) => r.model));
  const configuredOnly = configuredModels
    .filter((m) => !offered.has(m.model))
    .map<ChecklistRow>((m) => ({
      model: m.model,
      title: m.name,
      description: m.model,
      configured: true,
    }));
  return { top, other, configuredOnly };
}

/**
 * Checked at the start: everything already configured; for a provider with
 * nothing configured, the first few popular models.
 */
export function initialChecked(
  groups: ChecklistGroups,
  configuredModels: ProviderSetupModel[],
  count = DEFAULT_CHECKED_COUNT,
): Set<string> {
  if (configuredModels.length > 0) {
    return new Set(configuredModels.map((m) => m.model));
  }
  return new Set(
    groups.top
      .filter((r) => !r.deprecated)
      .slice(0, count)
      .map((r) => r.model),
  );
}

/** Rows matching a search, best match first. An empty query keeps the order. */
export function filterRows(
  rows: ChecklistRow[],
  query: string,
): ChecklistRow[] {
  const q = query.trim();
  if (!q) return rows;
  return rows
    .map((row) => ({
      row,
      score: Math.max(fuzzyScore(q, row.title), fuzzyScore(q, row.model) * 0.8),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ row }) => row);
}

export interface SelectionDiff {
  add: ChecklistRow[];
  /** Configured models that are now unchecked. */
  remove: ProviderSetupModel[];
  /** Configured models that stay. */
  keep: ProviderSetupModel[];
}

export function diffSelection(
  groups: ChecklistGroups,
  configuredModels: ProviderSetupModel[],
  checked: Set<string>,
): SelectionDiff {
  const configured = new Set(configuredModels.map((m) => m.model));
  const all = [...groups.top, ...groups.other, ...groups.configuredOnly];
  const seen = new Set<string>();
  const add = all.filter((row) => {
    if (seen.has(row.model)) return false;
    seen.add(row.model);
    return checked.has(row.model) && !configured.has(row.model);
  });
  return {
    add,
    remove: configuredModels.filter((m) => !checked.has(m.model)),
    keep: configuredModels.filter((m) => checked.has(m.model)),
  };
}

export interface KeyChoice {
  storage: KeyStorage;
  secretName: string;
  /** Empty means "keep what is stored". */
  value: string;
}

export const KEY_STORAGE_LABELS: Record<KeyStorage, string> = {
  secure: "Secure storage (this editor)",
  env: "~/.continue/.env file",
  envVar: "Environment variable (nothing is stored)",
  inline: "Inside config.yaml (not recommended)",
};

export function keyStorageOptions(
  secureAvailable: boolean,
): { value: KeyStorage; label: string }[] {
  const order: KeyStorage[] = secureAvailable
    ? ["secure", "env", "envVar", "inline"]
    : ["env", "envVar", "inline"];
  return order.map((value) => ({ value, label: KEY_STORAGE_LABELS[value] }));
}

/** Environment variable names: letters, digits, underscores; no leading digit. */
export function isValidSecretName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/** Why the key section cannot be submitted, or undefined when it can. */
export function keyProblem(
  choice: KeyChoice,
  options: { keyRequired: boolean },
): string | undefined {
  if (choice.storage !== "inline" && !isValidSecretName(choice.secretName)) {
    return "Use letters, digits and underscores only, not starting with a digit";
  }
  if (choice.storage === "envVar") return undefined;
  if (
    choice.value === "" &&
    (options.keyRequired || choice.storage === "inline")
  ) {
    return "Enter the key";
  }
  return undefined;
}

/** The connection a form describes, in the form core matches entries by. */
export function connectionFromModel(
  model: Record<string, any>,
): ProviderConnectionKey {
  const connection: ProviderConnectionKey = {};
  for (const key of ["apiBase", "region", "profile"] as const) {
    const value = model[key];
    if (typeof value === "string" && value.trim() !== "") {
      connection[key] = value.trim();
    }
  }
  return connection;
}

/** Same connection as an existing one (what core calls the same endpoint). */
export function sameConnection(
  a: ProviderConnectionKey,
  b: ProviderConnectionKey,
): boolean {
  const norm = (c: ProviderConnectionKey) =>
    [
      c.apiBase?.replace(/\/+$/, "") ?? "",
      c.region ?? "",
      c.profile ?? "",
    ].join("|");
  return norm(a) === norm(b);
}

/** True for OpenAI's own API, false for any other OpenAI-compatible server. */
export function isOpenAICloud(apiBase: string): boolean {
  try {
    return new URL(apiBase).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

/** The configured connection of a provider that matches the form's values. */
export function findConnection(
  connections: ProviderSetupConnection[],
  provider: string,
  connection: ProviderConnectionKey,
): ProviderSetupConnection | undefined {
  return connections.find(
    (c) => c.provider === provider && sameConnection(c.connection, connection),
  );
}

/** "http://localhost:1234/v1", "us-east-1 (work)" or "default endpoint". */
export function describeConnection(c: ProviderConnectionKey): string {
  const parts = [c.apiBase, c.region, c.profile ? `(${c.profile})` : undefined];
  const text = parts.filter(Boolean).join(" ");
  return text || "default endpoint";
}

export interface BuildRequestArgs {
  provider: ProviderInfo;
  /**
   * The connection being edited, as it is in config.yaml now. When the form
   * describes a different endpoint, core changes that connection in place.
   */
  editing?: ProviderConnectionKey;
  values: FormValues;
  diff: SelectionDiff;
  /** Whether to send the key section at all. */
  key?: KeyChoice;
  /** Live Bedrock titles ("... (Bedrock)") are used as the name. */
  useLiveTitles?: boolean;
}

/**
 * The `config/saveProviderModels` request for a finished flow. The key goes
 * into `key` only and never into the model descriptions.
 */
export function buildSaveRequest({
  provider,
  editing,
  values,
  diff,
  key,
  useLiveTitles,
}: BuildRequestArgs): SaveProviderModelsRequest {
  const add = diff.add
    .filter((row) => row.pkg)
    .map((row) => {
      const pkg = row.pkg!;
      const model = buildModelFromForm(
        provider,
        pkg,
        { ...values, apiKey: undefined },
        { title: useLiveTitles ? pkg.params.title : undefined },
      );
      delete model.apiKey;
      return model;
    });

  const connection = connectionFromModel(
    add[0] ??
      buildModelFromForm(
        provider,
        provider.packages[0],
        { ...values, apiKey: undefined },
        {},
      ),
  );

  const request: SaveProviderModelsRequest = {
    provider: provider.provider,
    connection,
    add,
    remove: diff.remove.map((m) => m.name),
  };
  if (editing && !sameConnection(editing, connection)) {
    request.from = editing;
  }
  if (key) {
    request.key = {
      storage: key.storage,
      ...(key.storage === "inline" ? {} : { secretName: key.secretName }),
      ...(key.storage !== "envVar" && key.value !== ""
        ? { value: key.value }
        : {}),
    };
  }
  return request;
}

/** One sentence for the review step about where the key goes. */
export function describeKeyPlan(
  key: KeyChoice | undefined,
  providerTitle: string,
): string {
  if (!key) return `The ${providerTitle} key stays as it is.`;
  switch (key.storage) {
    case "secure":
      return key.value
        ? `The ${providerTitle} key is saved in this editor's secure storage as ${key.secretName}. config.yaml only refers to it.`
        : `Models refer to ${key.secretName} in secure storage.`;
    case "env":
      return key.value
        ? `The ${providerTitle} key is saved in ~/.continue/.env as ${key.secretName}. config.yaml only refers to it.`
        : `Models refer to ${key.secretName} in ~/.continue/.env.`;
    case "envVar":
      return `Models refer to the environment variable ${key.secretName}. Nothing is stored; set it before starting the editor.`;
    case "inline":
      return `The ${providerTitle} key is written into config.yaml.`;
  }
}
