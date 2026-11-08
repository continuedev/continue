import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import {
  clearDefault,
  isListMode,
  ModeDraft,
  setDefault,
  TableMode,
  toggleOffered,
} from "../../../util/modeModelsDraft";

export const MODE_LABEL: Record<TableMode, string> = {
  chat: "Chat",
  plan: "Plan",
  agent: "Agent",
  loop: "Loop",
  replan: "Re-plan",
  subagent: "Subagent",
};

/** What a column without a model of its own falls back to. */
export const MODE_FALLBACK_HINT: Partial<Record<TableMode, string>> = {
  loop: "Loop items. Without a star, the Agent model.",
  replan: "Loop re-plans and check-ins. Without a star, the Plan model.",
  subagent:
    "Subagents whose definition names no model. Without a star, the model of the turn that started them.",
};

/**
 * One checkbox and default star: a model in a mode. A single-model use (Loop,
 * Re-plan, Subagent) has only the star; pressing it again clears the choice.
 */
export function ModeCell({
  mode,
  title,
  draft,
  onChange,
}: {
  mode: TableMode;
  title: string;
  draft: ModeDraft;
  onChange: (next: ModeDraft) => void;
}) {
  const on = draft.offered.includes(title);
  const isDefault = draft.defaultTitle === title;
  const label = MODE_LABEL[mode];
  if (!isListMode(mode)) {
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          title={isDefault ? `Model for ${label}` : `Use for ${label}`}
          aria-label={`Default for ${label}: ${title}`}
          aria-pressed={isDefault}
          onClick={() =>
            onChange(isDefault ? clearDefault(draft) : setDefault(draft, title))
          }
          className="border-none bg-transparent p-0"
        >
          {isDefault ? (
            <StarSolid className="h-3 w-3" />
          ) : (
            <StarOutline className="h-3 w-3" />
          )}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="checkbox"
        checked={on}
        aria-label={`${label}: ${title}`}
        onChange={(e) =>
          onChange(toggleOffered(draft, title, e.target.checked))
        }
      />
      <button
        type="button"
        disabled={!on}
        title={isDefault ? `Default for ${label}` : `Make default for ${label}`}
        aria-label={`Default for ${label}: ${title}`}
        aria-pressed={isDefault}
        onClick={() => onChange(setDefault(draft, title))}
        className="border-none bg-transparent p-0 disabled:opacity-30"
      >
        {isDefault ? (
          <StarSolid className="h-3 w-3" />
        ) : (
          <StarOutline className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
