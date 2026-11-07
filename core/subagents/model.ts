import type { ModelDescription } from "..";

const FAMILY_ALIASES = ["opus", "sonnet", "haiku", "fable", "mythos"];

export interface ResolvedSubagentModel {
  model: ModelDescription;
  /** Set when the definition named a model that is not configured. */
  fallbackReason?: string;
}

/**
 * The configured chat model a definition's `model` names. Tried in order: an
 * exact title, an exact model id, then a Claude Code family alias (`sonnet`,
 * `opus`, `haiku`...) against the model ids, preferring the parent's own
 * provider. A model that is not configured falls back to the parent's chat
 * model, as `inherit` (or no `model`) does, since a subagent can only use a
 * model the person has set up.
 */
export function resolveSubagentModel(
  requested: string | undefined,
  chatModels: ModelDescription[],
  parent: ModelDescription,
): ResolvedSubagentModel {
  const want = requested?.trim();
  if (!want || want.toLowerCase() === "inherit") return { model: parent };
  const lower = want.toLowerCase();

  const byTitle = chatModels.find((m) => m.title.toLowerCase() === lower);
  if (byTitle) return { model: byTitle };

  const byId = chatModels.find((m) => m.model.toLowerCase() === lower);
  if (byId) return { model: byId };

  if (FAMILY_ALIASES.includes(lower)) {
    if (parent.model.toLowerCase().includes(lower)) return { model: parent };
    const family = chatModels.filter((m) =>
      m.model.toLowerCase().includes(lower),
    );
    const sameProvider = family.find((m) => m.provider === parent.provider);
    const found = sameProvider ?? family[0];
    if (found) return { model: found };
  }

  return {
    model: parent,
    fallbackReason: `model "${want}" is not configured; using ${parent.title}`,
  };
}
