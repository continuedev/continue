import type { ProviderInstance } from "../schemas/models.js";
import type { ConfigValidationError } from "../validation.js";

/** Fields a provider instance supplies to the models that name it. */
type Connectable = {
  name?: string;
  provider?: string;
  connection?: string;
  apiKey?: string;
  apiBase?: string;
  env?: Record<string, string | number | boolean>;
  requestOptions?: {
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Fill in each model's connection settings from the provider instance it
 * names with `connection:`. The model's own values win; `env` and
 * `requestOptions` (and its headers) are merged, the model's keys over the
 * instance's. A model naming an instance that does not exist is dropped and
 * reported, and so is one whose `provider` contradicts its instance's.
 *
 * Runs on the unrolled config before secrets are rendered, so an instance's
 * `${{ secrets.NAME }}` resolves like any other in the config.
 */
export function resolveModelConnections<T>(
  models: (T | null)[] | undefined,
  providers: ProviderInstance[] | undefined,
): { models: (T | null)[] | undefined; errors: ConfigValidationError[] } {
  const errors: ConfigValidationError[] = [];
  if (!models) return { models, errors };

  const byName = new Map<string, ProviderInstance>();
  for (const p of providers ?? []) byName.set(p.name, p);

  const resolved = models.map((raw) => {
    const model = raw as Connectable | null;
    if (!model || typeof model !== "object" || !model.connection) return raw;

    const instance = byName.get(model.connection);
    if (!instance) {
      errors.push({
        fatal: false,
        message: `Model "${model.name ?? "(unnamed)"}" uses connection "${model.connection}", which is not defined in providers.yaml. The model was skipped.`,
      });
      return null;
    }
    if (model.provider && model.provider !== instance.provider) {
      errors.push({
        fatal: false,
        message: `Model "${model.name ?? "(unnamed)"}" says provider "${model.provider}" but its connection "${instance.name}" is a "${instance.provider}" provider. The model was skipped.`,
      });
      return null;
    }

    const merged: Connectable = {
      ...model,
      provider: instance.provider,
      apiKey: model.apiKey ?? instance.apiKey,
      apiBase: model.apiBase ?? instance.apiBase,
    };
    if (instance.env || model.env) {
      merged.env = { ...(instance.env ?? {}), ...(model.env ?? {}) };
    }
    if (instance.requestOptions || model.requestOptions) {
      const headers = {
        ...(instance.requestOptions?.headers ?? {}),
        ...(model.requestOptions?.headers ?? {}),
      };
      merged.requestOptions = {
        ...(instance.requestOptions ?? {}),
        ...(model.requestOptions ?? {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      };
    }
    for (const key of ["apiKey", "apiBase"] as const) {
      if (merged[key] === undefined) delete merged[key];
    }
    return merged as unknown as T;
  });

  return { models: resolved, errors };
}
