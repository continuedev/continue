import type {
  BrowserSerializedContinueConfig,
  ModeReasoningEffort,
} from "core";
import type { ModeModelsInput } from "core/config/yaml/saveModeModels";

/**
 * The table's columns: the three modes, which offer a list of models, then
 * the single-model uses (one star, no list). The reviewer has its own picker
 * in the Models section and is not here.
 */
export const TABLE_MODES = [
  "chat",
  "plan",
  "agent",
  "loop",
  "replan",
  "subagent",
] as const;
export type TableMode = (typeof TABLE_MODES)[number];

/** The columns with a model picker, where ticking several models makes sense. */
export const LIST_MODES: readonly TableMode[] = ["chat", "plan", "agent"];

export function isListMode(mode: TableMode): boolean {
  return LIST_MODES.includes(mode);
}

/** What the Models tab shows and edits for one mode. */
export interface ModeDraft {
  /** Models offered in the mode, in order. */
  offered: string[];
  /** Model selected when switching into the mode. Always in `offered`. */
  defaultTitle: string | undefined;
  /** Undefined means no `reasoningEffort` is set. */
  effort: ModeReasoningEffort | undefined;
  /**
   * True when config.yaml gives this mode only a default `model`, which the
   * picker treats as "every model is offered". The table then shows just the
   * default as ticked, and leaves the config's list alone unless the user
   * ticks more than that.
   */
  implicitAll: boolean;
}

export type ModeDrafts = Record<TableMode, ModeDraft>;

export function draftFromConfig(
  config: Pick<BrowserSerializedContinueConfig, "modeModels">,
): ModeDrafts {
  const drafts = {} as ModeDrafts;
  for (const mode of TABLE_MODES) {
    const entry = config.modeModels?.[mode];
    const offered = entry?.titles?.length
      ? [...entry.titles]
      : entry
        ? [entry.title]
        : [];
    drafts[mode] = {
      offered,
      defaultTitle: entry?.title,
      effort: entry?.reasoningEffort,
      implicitAll: !!entry && !entry.titles?.length,
    };
  }
  return drafts;
}

/** Keep the default valid and first: it is always one of the offered models. */
function normalize(draft: ModeDraft): ModeDraft {
  const offered = draft.offered.filter(
    (t, i) => draft.offered.indexOf(t) === i,
  );
  const defaultTitle =
    draft.defaultTitle && offered.includes(draft.defaultTitle)
      ? draft.defaultTitle
      : offered[0];
  return {
    ...draft,
    offered: defaultTitle
      ? [defaultTitle, ...offered.filter((t) => t !== defaultTitle)]
      : offered,
    defaultTitle,
  };
}

/** Tick or untick a model for a mode. The first ticked model becomes the default. */
export function toggleOffered(
  draft: ModeDraft,
  title: string,
  on: boolean,
): ModeDraft {
  const offered = on
    ? draft.offered.includes(title)
      ? draft.offered
      : [...draft.offered, title]
    : draft.offered.filter((t) => t !== title);
  return normalize({
    ...draft,
    offered,
    // Ticking more than the implicit default turns it into an explicit list.
    implicitAll: draft.implicitAll && offered.length <= 1,
    defaultTitle:
      draft.defaultTitle === title && !on ? undefined : draft.defaultTitle,
  });
}

/** A single-model use with nothing chosen: the fallback applies. */
export function clearDefault(draft: ModeDraft): ModeDraft {
  return { ...draft, offered: [], defaultTitle: undefined, implicitAll: false };
}

/** Make a model the mode's default; this also ticks it. */
export function setDefault(draft: ModeDraft, title: string): ModeDraft {
  const offered = draft.offered.includes(title)
    ? draft.offered
    : [...draft.offered, title];
  return normalize({
    ...draft,
    offered,
    defaultTitle: title,
    implicitAll: draft.implicitAll && offered.length <= 1,
  });
}

export function setEffort(
  draft: ModeDraft,
  effort: ModeReasoningEffort | undefined,
): ModeDraft {
  return { ...draft, effort };
}

function same(a: ModeDraft, b: ModeDraft): boolean {
  return (
    a.defaultTitle === b.defaultTitle &&
    a.effort === b.effort &&
    a.offered.length === b.offered.length &&
    a.offered.every((t, i) => t === b.offered[i])
  );
}

/**
 * The `config/setModeModels` payload for the difference between what was
 * loaded and what the user now has. Only changed modes are included, so
 * modes the user did not touch are never rewritten.
 */
export function buildUpdate(
  original: ModeDrafts,
  current: ModeDrafts,
): ModeModelsInput {
  const update: ModeModelsInput = {};
  for (const mode of TABLE_MODES) {
    const before = original[mode];
    const after = normalize(current[mode]);
    if (same(before, after)) continue;

    if (after.offered.length === 0) {
      // Nothing ticked: remove the mode's entry (the model stays as selected).
      update[mode] = null;
      continue;
    }

    const change: NonNullable<ModeModelsInput[TableMode]> = {
      model: after.defaultTitle,
    };
    // One ticked model on a mode that had no list stays a plain `model:`
    // (every model is still offered, as before). More than one, or a mode that
    // already had an explicit list, is written as a list.
    // A single-model use never has a list.
    const hadExplicitList = before.offered.length > 0 && !before.implicitAll;
    if (isListMode(mode) && (after.offered.length > 1 || hadExplicitList)) {
      change.models = after.offered;
    }
    if (after.effort !== before.effort) {
      change.reasoningEffort = after.effort ?? null;
    }
    update[mode] = change;
  }
  return update;
}

export function hasChanges(update: ModeModelsInput): boolean {
  return Object.keys(update).length > 0;
}
