import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import {
  ModeDraft,
  setDefault,
  TableMode,
  toggleOffered,
} from "../../../util/modeModelsDraft";

export const MODE_LABEL: Record<TableMode, string> = {
  chat: "Chat",
  plan: "Plan",
  agent: "Agent",
};

/** One checkbox and default star: a model in a mode. */
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
