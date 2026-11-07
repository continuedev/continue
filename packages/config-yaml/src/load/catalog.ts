import type { CatalogModel } from "../schemas/models.js";
import type { ConfigValidationError } from "../validation.js";

type PlainObject = Record<string, unknown>;

const isPlainObject = (v: unknown): v is PlainObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The merge for catalog layers: objects merge key by key (recursively), so a
 * variant can change one completion option and keep the rest; scalars and
 * lists replace.
 */
export function mergeModelLayers(...layers: (PlainObject | undefined)[]) {
  const out: PlainObject = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined) continue;
      out[key] =
        isPlainObject(value) && isPlainObject(out[key])
          ? mergeModelLayers(out[key] as PlainObject, value)
          : value;
    }
  }
  return out;
}

/** `Name#variant` into its parts. Only the last `#` separates them. */
export function parseCatalogRef(ref: string): {
  name: string;
  variant?: string;
} {
  const at = ref.lastIndexOf("#");
  if (at <= 0 || at === ref.length - 1) return { name: ref };
  return { name: ref.slice(0, at), variant: ref.slice(at + 1) };
}

/**
 * One catalog model (with a variant, if named) as a config model: the
 * catalog entry, then the variant, then the config's own fields. Its name is
 * the reference, so `Name#variant` is what pickers and modeModels see.
 */
function expand(
  ref: string,
  catalog: Map<string, CatalogModel>,
  own: PlainObject = {},
): { model?: PlainObject; error?: string } {
  const { name, variant } = parseCatalogRef(ref);
  const entry = catalog.get(name);
  if (!entry) {
    return {
      error: `"${ref}" is not a model in models.yaml. The model was skipped.`,
    };
  }
  const { variants, routes, ...base } = entry;
  let variantFields: PlainObject | undefined;
  if (variant !== undefined) {
    variantFields = variants?.[variant] as PlainObject | undefined;
    if (!variantFields) {
      const known = Object.keys(variants ?? {});
      return {
        error: `"${name}" in models.yaml has no variant "${variant}"${
          known.length > 0 ? ` (it has ${known.join(", ")})` : ""
        }. The model was skipped.`,
      };
    }
  }
  const { from: _from, ...ownFields } = own;
  const model = mergeModelLayers(base as PlainObject, variantFields, ownFields);
  model.name = (ownFields.name as string | undefined) ?? ref;
  if (routes && routes.length > 0) model.routes = routes;
  return { model };
}

/** The names a config's modeModels pick, in order, without duplicates. */
function modeModelNames(modeModels: unknown): string[] {
  if (!isPlainObject(modeModels)) return [];
  const names: string[] = [];
  for (const mode of Object.values(modeModels)) {
    if (!isPlainObject(mode)) continue;
    const picks = [
      mode.model,
      ...(Array.isArray(mode.models) ? mode.models : []),
    ];
    for (const pick of picks) {
      if (typeof pick === "string" && !names.includes(pick)) names.push(pick);
    }
  }
  return names;
}

/**
 * Replace each `from: Name[#variant]` entry of a config's models with the
 * catalog model it names, and add the catalog models (and variants) that
 * the config's modeModels pick but its models list does not have, as chat
 * models, so a model can be assigned to a mode without listing it twice.
 *
 * Runs before connections are resolved, so a catalog model's `connection:`
 * is filled in like a config model's. An unknown name or variant is
 * reported and that entry skipped; the rest of the config still loads.
 */
export function resolveCatalogModels<T>(
  models: (T | null)[] | undefined,
  catalogModels: CatalogModel[] | undefined,
  modeModels?: unknown,
): { models: (T | null)[] | undefined; errors: ConfigValidationError[] } {
  const errors: ConfigValidationError[] = [];
  if (!catalogModels || catalogModels.length === 0) {
    for (const raw of models ?? []) {
      if (isPlainObject(raw) && typeof raw.from === "string") {
        errors.push({
          fatal: false,
          message: `"${raw.from}" is not a model in models.yaml (there is no models.yaml). The model was skipped.`,
        });
      }
    }
    return {
      models: models?.map((raw) =>
        isPlainObject(raw) && typeof raw.from === "string" ? null : raw,
      ),
      errors,
    };
  }

  const catalog = new Map(catalogModels.map((m) => [m.name, m]));
  const resolved: (T | null)[] = (models ?? []).map((raw) => {
    if (!isPlainObject(raw) || typeof raw.from !== "string") return raw;
    const { model, error } = expand(raw.from, catalog, raw);
    if (error) {
      errors.push({ fatal: false, message: error });
      return null;
    }
    return model as unknown as T;
  });

  const present = new Set(
    (resolved as unknown[])
      .filter(isPlainObject)
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string"),
  );
  for (const pick of modeModelNames(modeModels)) {
    if (present.has(pick)) continue;
    if (!catalog.has(parseCatalogRef(pick).name)) continue; // modeModels reports it
    const { model, error } = expand(pick, catalog, { roles: ["chat"] });
    if (error) {
      errors.push({ fatal: false, message: error });
      continue;
    }
    present.add(pick);
    resolved.push(model as unknown as T);
  }

  return {
    models: models === undefined && resolved.length === 0 ? models : resolved,
    errors,
  };
}
