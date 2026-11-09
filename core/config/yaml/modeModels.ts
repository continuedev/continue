import type { ModeModels } from "@continuedev/config-yaml";
import type { ConfigValidationError } from "@continuedev/config-yaml";
import type { ILLM, ModeModelsConfig, ModelUse } from "../..";
import { MODEL_USES, PICKER_USES } from "../../util/modelUse";

/**
 * Resolve `modeModels:` (which names models) against the loaded models.
 * Names that match no model are dropped with a non-fatal error so one typo
 * doesn't disable the whole config.
 *
 * - `model` alone: the use's default, exactly as before (`titles` is unset,
 *   so every model is offered).
 * - `models` (chat, plan and agent only): the models offered in the mode. The
 *   default is `model` when it exists, else the first listed model that does.
 *   The default is always in the offered list, first, and duplicates are
 *   removed.
 * - `reviewer` may name any model, whatever its roles; every other use names
 *   a chat model.
 */
export function resolveModeModels(
  modeModels: ModeModels | undefined,
  chatModels: Pick<ILLM, "title">[],
  allModels: Pick<ILLM, "title">[] = chatModels,
): {
  modeModels: ModeModelsConfig | undefined;
  errors: ConfigValidationError[];
} {
  if (!modeModels) {
    return { modeModels: undefined, errors: [] };
  }

  const resolved: ModeModelsConfig = {};
  const errors: ConfigValidationError[] = [];
  const titles = (models: Pick<ILLM, "title">[]) =>
    models.map((m) => m.title).filter((t): t is string => !!t);
  const knownChat = titles(chatModels);
  const knownAll = titles(allModels);
  const available = (known: string[], what: string) =>
    known.length > 0
      ? `Available models: ${known.join(", ")}.`
      : `No ${what} are configured.`;

  for (const use of MODEL_USES) {
    const entry = modeModels[use];
    if (!entry) continue;
    const anyRole = use === "reviewer";
    const known = anyRole ? knownAll : knownChat;
    const unknown = (where: string, name: string) =>
      errors.push({
        fatal: false,
        message: `modeModels.${where}: no ${anyRole ? "" : "chat "}model named "${name}". ${available(known, anyRole ? "models" : "chat models")}`,
      });

    let preferred: string | undefined;
    if (entry.model !== undefined) {
      if (known.includes(entry.model)) preferred = entry.model;
      else unknown(use, entry.model);
    }

    const listed: string[] = [];
    const list = isPickerUse(use) ? modeModels[use]?.models : undefined;
    for (const name of list ?? []) {
      if (!known.includes(name)) {
        unknown(`${use}.models`, name);
      } else if (!listed.includes(name)) {
        listed.push(name);
      }
    }

    const title = preferred ?? listed[0];
    if (title === undefined) continue; // nothing usable: drop the entry

    const offered = list
      ? [title, ...listed.filter((name) => name !== title)]
      : undefined;
    resolved[use] = {
      title,
      ...(offered ? { titles: offered } : {}),
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

function isPickerUse(use: ModelUse): use is "chat" | "plan" | "agent" {
  return (PICKER_USES as readonly string[]).includes(use);
}
