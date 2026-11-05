import type { ConfigYaml } from "@continuedev/config-yaml";
import { editConfigFile } from "../../util/paths";

const MODES = ["chat", "agent", "plan"] as const;

/**
 * One mode's change from the Models tab. Fields left out are kept as they are
 * in config.yaml. `null` for `reasoningEffort` removes it.
 */
export interface ModeModelChange {
  /** Default model when switching into the mode (by name). */
  model?: string;
  /** Models offered in the mode (by name). `[]` removes the list. */
  models?: string[];
  reasoningEffort?: "off" | "low" | "medium" | "high" | null;
}

/** A mode set to `null` has its entry removed; modes not present are untouched. */
export type ModeModelsInput = Partial<
  Record<(typeof MODES)[number], ModeModelChange | null>
>;

export type ModeModelsUpdate = ModeModelsInput;

/**
 * Apply the Models-tab selection to a config.yaml object.
 *
 * Each mode in `update` either carries a default `model`, a `models` list and
 * an optional `reasoningEffort`, or is `null` to remove the mode's entry.
 * Modes not mentioned are left exactly as they are. Within a mode, fields the
 * update does not mention (for example a hand-written `reasoningEffort`) are
 * kept; `models: []` removes the list.
 *
 * Names are written as given. Whether they exist is checked when the config is
 * loaded (`resolveModeModels`), which reports unknown names without failing.
 */
export function applyModeModelsUpdate(
  config: ConfigYaml,
  update: ModeModelsUpdate,
): ConfigYaml {
  const next: Record<string, any> = { ...(config.modeModels ?? {}) };

  for (const mode of MODES) {
    if (!(mode in update)) continue;
    const change = update[mode];
    if (change === null || change === undefined) {
      delete next[mode];
      continue;
    }

    const entry: Record<string, any> = { ...(next[mode] ?? {}) };
    const models = dedupe(change.models);

    if (change.model !== undefined) entry.model = change.model;
    if (change.models !== undefined) {
      if (models.length > 0) entry.models = models;
      else delete entry.models;
    }
    if (change.reasoningEffort !== undefined) {
      if (change.reasoningEffort === null) delete entry.reasoningEffort;
      else entry.reasoningEffort = change.reasoningEffort;
    }

    // The schema needs `model` or a non-empty `models`; an entry with neither
    // would make the whole config invalid, so drop it instead.
    if (entry.model === undefined && !(entry.models?.length > 0)) {
      delete next[mode];
    } else {
      next[mode] = entry;
    }
  }

  const result: Record<string, any> = { ...config };
  if (Object.keys(next).length > 0) result.modeModels = next;
  else delete result.modeModels;
  return result as ConfigYaml;
}

function dedupe(names: string[] | undefined): string[] {
  const seen: string[] = [];
  for (const name of names ?? []) {
    if (typeof name === "string" && name !== "" && !seen.includes(name)) {
      seen.push(name);
    }
  }
  return seen;
}

/**
 * Write the update to the selected config, keeping comments and key order.
 * Returns false when the selected config is not a local YAML file, so
 * the caller can say so instead of silently doing nothing.
 */
export function saveModeModels(update: ModeModelsUpdate): boolean {
  let edited = false;
  editConfigFile(
    // config.json has no modeModels; leave it untouched.
    (config) => config,
    (config) => {
      edited = true;
      return applyModeModelsUpdate(config, update);
    },
  );
  return edited;
}
