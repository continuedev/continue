import type { CatalogModel, ConfigYaml } from "@continuedev/config-yaml";

import { editConfigFile } from "../../util/paths";

import { ASSIGNABLE_ROLES, type AssignableRole } from "./modelRoles";

export { ASSIGNABLE_ROLES, type AssignableRole } from "./modelRoles";

export interface ModelRolesUpdate {
  /** A catalog reference (`Name` or `Name#variant`) or a config model's name. */
  ref: string;
  /** The assignable roles it should have; roles outside that set are kept. */
  roles: AssignableRole[];
}

/** One entry of the catalog as the GUI lists it: each model and each variant. */
export interface CatalogListEntry {
  /** What a config uses with `from:`, and what pickers show. */
  ref: string;
  name: string;
  variant?: string;
  model: string;
  account?: string;
  provider?: string;
}

/** The catalog as a flat list: each model, then each of its variants. */
export function listCatalog(
  catalog: CatalogModel[],
  accounts: { name: string; provider: string }[],
): CatalogListEntry[] {
  const providerOf = new Map(accounts.map((a) => [a.name, a.provider]));
  const out: CatalogListEntry[] = [];
  for (const m of catalog) {
    const provider =
      m.provider ?? (m.connection ? providerOf.get(m.connection) : undefined);
    const base = {
      name: m.name,
      model: m.model,
      ...(m.connection ? { account: m.connection } : {}),
      ...(provider ? { provider } : {}),
    };
    out.push({ ref: m.name, ...base });
    for (const variant of Object.keys(m.variants ?? {})) {
      out.push({ ref: `${m.name}#${variant}`, variant, ...base });
    }
  }
  return out;
}

type Entry = Record<string, any>;

const refOf = (m: Entry): string | undefined =>
  typeof m?.from === "string" ? (m.name ?? m.from) : m?.name;

/**
 * Apply role changes to a config. A model already in the config gets the
 * new assignable roles (its other roles stay). A catalog reference that is
 * not in the config yet is added as `from:` with those roles. A `from:`
 * entry left with no roles at all is removed; an inline model keeps an
 * empty `roles` list, so it stays defined but is not used.
 */
export function applyModelRoles(
  config: ConfigYaml,
  updates: ModelRolesUpdate[],
): ConfigYaml {
  const assignable = new Set<string>(ASSIGNABLE_ROLES);
  let models: Entry[] = [...((config.models ?? []) as Entry[])];
  for (const { ref, roles } of updates) {
    const wanted = roles.filter((r) => assignable.has(r));
    const index = models.findIndex(
      (m) => m && typeof m === "object" && (refOf(m) === ref || m.from === ref),
    );
    if (index === -1) {
      if (wanted.length > 0) models.push({ from: ref, roles: wanted });
      continue;
    }
    const entry = models[index];
    // An entry without roles has the default ones; the table shows those
    const current: string[] = Array.isArray(entry.roles)
      ? entry.roles
      : ["chat", "edit", "apply", "summarize"];
    const kept = current.filter((r) => !assignable.has(r));
    const next = [...kept, ...wanted];
    if (next.length === 0 && entry.from) {
      models = models.filter((_, i) => i !== index);
      continue;
    }
    models[index] = { ...entry, roles: next };
  }
  return { ...config, models } as ConfigYaml;
}

/** applyModelRoles on the selected config. False when it is not a local YAML file. */
export function saveModelRoles(updates: ModelRolesUpdate[]): boolean {
  let edited = false;
  editConfigFile(
    (config) => config,
    (config) => {
      edited = true;
      return applyModelRoles(config, updates);
    },
  );
  return edited;
}
