import type { ModelDescription } from "..";

const FAMILY_ALIASES = ["opus", "sonnet", "haiku", "fable", "mythos"];

/**
 * What a configured model is matched on: the IDE's ModelDescription, or the
 * CLI's model config read as one (`name` as the title).
 */
export type ModelCandidate = Pick<
  ModelDescription,
  "title" | "model" | "provider"
>;

export interface ResolvedSubagentModel<
  M extends ModelCandidate = ModelDescription,
> {
  model: M;
  /** Set when the definition named a model that is not configured. */
  fallbackReason?: string;
}

/**
 * The configured chat model a name refers to, or undefined. Tried in order:
 * an exact title, an exact model id, then a Claude Code family alias
 * (`sonnet`, `opus`, `haiku`...) against the model ids, preferring `prefer`
 * itself and then its provider.
 */
export function findConfiguredModel<M extends ModelCandidate>(
  name: string,
  chatModels: M[],
  prefer?: M,
): M | undefined {
  const lower = name.trim().toLowerCase();
  if (!lower) return undefined;

  const byTitle = chatModels.find((m) => m.title.toLowerCase() === lower);
  if (byTitle) return byTitle;

  const byId = chatModels.find((m) => m.model.toLowerCase() === lower);
  if (byId) return byId;

  if (FAMILY_ALIASES.includes(lower)) {
    if (prefer?.model.toLowerCase().includes(lower)) return prefer;
    const family = chatModels.filter((m) =>
      m.model.toLowerCase().includes(lower),
    );
    const sameProvider = family.find((m) => m.provider === prefer?.provider);
    return sameProvider ?? family[0];
  }
  return undefined;
}

/**
 * The configured chat model a definition's `model` names. Tried in order: an
 * exact title, an exact model id, then a Claude Code family alias (`sonnet`,
 * `opus`, `haiku`...) against the model ids, preferring the parent's own
 * provider. A model that is not configured falls back to the parent's chat
 * model, as `inherit` (or no `model`) does, since a subagent can only use a
 * model the person has set up.
 */
export function resolveSubagentModel<M extends ModelCandidate>(
  requested: string | undefined,
  chatModels: M[],
  parent: M,
): ResolvedSubagentModel<M> {
  const want = requested?.trim();
  if (!want || want.toLowerCase() === "inherit") return { model: parent };
  const found = findConfiguredModel(want, chatModels, parent);
  if (found) return { model: found };
  return {
    model: parent,
    fallbackReason: `model "${want}" is not configured; using ${parent.title}`,
  };
}
