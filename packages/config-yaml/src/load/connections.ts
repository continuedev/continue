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

/** At most this many routes for one model, the first included. */
export const MAX_ROUTES = 3;

/** A route's account and wire id in place of the model's own. */
function mergeRoute(model: Connectable, route: Connectable): Connectable {
  const out: Connectable = { ...model, connection: route.connection };
  if (route.model) out.model = route.model;
  if (route.apiBase) out.apiBase = route.apiBase;
  if (route.env) out.env = { ...(model.env ?? {}), ...route.env };
  if (route.requestOptions) {
    out.requestOptions = {
      ...(model.requestOptions ?? {}),
      ...route.requestOptions,
    };
  }
  return out;
}

/**
 * The instance's provider, key, address, env and request options under the
 * target's own (a model, or one of its routes).
 */
function connect(target: Connectable, instance: ProviderInstance): Connectable {
  const merged: Connectable = {
    ...target,
    provider: instance.provider,
    apiKey: target.apiKey ?? instance.apiKey,
    apiBase: target.apiBase ?? instance.apiBase,
  };
  if (instance.env || target.env) {
    merged.env = { ...(instance.env ?? {}), ...(target.env ?? {}) };
  }
  if (instance.requestOptions || target.requestOptions) {
    const headers = {
      ...(instance.requestOptions?.headers ?? {}),
      ...(target.requestOptions?.headers ?? {}),
    };
    merged.requestOptions = {
      ...(instance.requestOptions ?? {}),
      ...(target.requestOptions ?? {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }
  for (const key of ["apiKey", "apiBase"] as const) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}

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
    let model = raw as Connectable | null;
    if (!model || typeof model !== "object") return raw;

    // Routes: a model with no account of its own is served by its first
    // route; the rest are tried after it
    let routes = Array.isArray(model.routes)
      ? (model.routes as Connectable[])
      : undefined;
    if (routes && routes.length > 0 && !model.connection && !model.provider) {
      const [first, ...rest] = routes;
      model = mergeRoute(model, first);
      routes = rest;
    }
    if (routes && routes.length > MAX_ROUTES - 1) {
      errors.push({
        fatal: false,
        message: `Model "${model.name ?? "(unnamed)"}" has more than ${MAX_ROUTES} routes; only the first ${MAX_ROUTES} are used.`,
      });
      routes = routes.slice(0, MAX_ROUTES - 1);
    }
    if (routes !== undefined) {
      model = { ...model };
      if (routes.length > 0) model.routes = routes;
      else delete model.routes;
    }

    const instance = model.connection
      ? byName.get(model.connection)
      : undefined;
    if (model.connection && !instance) {
      errors.push({
        fatal: false,
        message: `Model "${model.name ?? "(unnamed)"}" uses connection "${model.connection}", which is not defined in providers.yaml. The model was skipped.`,
      });
      return null;
    }
    if (instance && model.provider && model.provider !== instance.provider) {
      errors.push({
        fatal: false,
        message: `Model "${model.name ?? "(unnamed)"}" says provider "${model.provider}" but its connection "${instance.name}" is a "${instance.provider}" provider. The model was skipped.`,
      });
      return null;
    }
    if (!instance && !routes?.length) return model as unknown as T;
    const merged = instance ? connect(model, instance) : { ...model };

    if (routes && routes.length > 0) {
      const connected: Connectable[] = [];
      for (const route of routes) {
        const routeInstance = byName.get(route.connection ?? "");
        if (!routeInstance) {
          errors.push({
            fatal: false,
            message: `Model "${model.name ?? "(unnamed)"}" has a route through connection "${route.connection}", which is not defined in providers.yaml. That route was skipped.`,
          });
          continue;
        }
        connected.push(connect(route, routeInstance));
      }
      if (connected.length > 0) merged.routes = connected;
      else delete merged.routes;
    }
    return merged as unknown as T;
  });

  return { models: resolved, errors };
}
