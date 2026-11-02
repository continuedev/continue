import type { ModeModels } from "@continuedev/config-yaml";
import type { ConfigValidationError } from "@continuedev/config-yaml";
import type { ILLM, ModeModelsConfig } from "../..";

const MODES = ["chat", "agent", "plan"] as const;

/**
 * Resolve `modeModels:` (which names models) against the loaded chat models.
 * Entries naming an unknown model are dropped with a non-fatal error so one
 * typo doesn't disable the whole config.
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

  for (const mode of MODES) {
    const entry = modeModels[mode];
    if (!entry) continue;
    if (!known.includes(entry.model)) {
      errors.push({
        fatal: false,
        message: `modeModels.${mode}: no chat model named "${entry.model}". ${
          known.length > 0
            ? `Available models: ${known.join(", ")}.`
            : "No chat models are configured."
        }`,
      });
      continue;
    }
    resolved[mode] = {
      title: entry.model,
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
