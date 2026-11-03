import type { ModeModels } from "@continuedev/config-yaml";
import type { ConfigValidationError } from "@continuedev/config-yaml";
import type { ILLM, ModeModelsConfig } from "../..";

const MODES = ["chat", "agent", "plan"] as const;

/**
 * Resolve `modeModels:` (which names models) against the loaded chat models.
 * Names that match no model are dropped with a non-fatal error so one typo
 * doesn't disable the whole config.
 *
 * - `model` alone: the mode's default, exactly as before (`titles` is unset,
 *   so every model is offered).
 * - `models`: the models offered in the mode. The default is `model` when it
 *   exists, else the first listed model that does. The default is always in
 *   the offered list, first, and duplicates are removed.
 */
export function resolveModeModels(
  modeModels: ModeModels | undefined,
  chatModels: Pick<ILLM, "title">[],
): {
  modeModels: ModeModelsConfig | undefined;
  errors: ConfigValidationError[];
} {
  if (!modeModels) {
    return { modeModels: undefined, errors: [] };
  }

  const resolved: ModeModelsConfig = {};
  const errors: ConfigValidationError[] = [];
  const known = chatModels.map((m) => m.title).filter(Boolean);
  const available = () =>
    known.length > 0
      ? `Available models: ${known.join(", ")}.`
      : "No chat models are configured.";
  const unknown = (where: string, name: string) =>
    errors.push({
      fatal: false,
      message: `modeModels.${where}: no chat model named "${name}". ${available()}`,
    });

  for (const mode of MODES) {
    const entry = modeModels[mode];
    if (!entry) continue;

    let preferred: string | undefined;
    if (entry.model !== undefined) {
      if (known.includes(entry.model)) preferred = entry.model;
      else unknown(mode, entry.model);
    }

    const listed: string[] = [];
    for (const name of entry.models ?? []) {
      if (!known.includes(name)) {
        unknown(`${mode}.models`, name);
      } else if (!listed.includes(name)) {
        listed.push(name);
      }
    }

    const title = preferred ?? listed[0];
    if (title === undefined) continue; // nothing usable: drop the entry

    const titles = entry.models
      ? [title, ...listed.filter((name) => name !== title)]
      : undefined;
    resolved[mode] = {
      title,
      ...(titles ? { titles } : {}),
      ...(entry.reasoningEffort
        ? { reasoningEffort: entry.reasoningEffort }
        : {}),
    };
  }

  return {
    modeModels: Object.keys(resolved).length > 0 ? resolved : undefined,
    errors,
  };
}
