import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  allowBlockedOnce,
  canAllowOnce,
  clearBlockedCalls,
} from "../../redux/slices/blockedCallsSlice";
import { decisionLabel } from "../../pages/gui/ToolCallDiv/DecisionChip";

/**
 * Calls refused this session (kept in memory only), with who refused each and
 * why. A call that the Auto reviewer refused can be allowed once; the others
 * come from your rules, protected paths or the safety check, which a click
 * here does not override.
 */
export function RecentlyBlocked() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.blockedCalls.items);
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div data-testid="recently-blocked" className="text-2xs">
      <button
        type="button"
        data-testid="recently-blocked-toggle"
        className="cursor-pointer border-none bg-transparent px-2 py-0.5 text-2xs text-description underline"
        onClick={() => setOpen(!open)}
      >
        Recently blocked ({items.length})
      </button>
      {open && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto px-2 pb-1">
          {items.map((item) => (
            <div
              key={item.id}
              data-testid={`blocked-${item.id}`}
              className="flex flex-col gap-0.5 rounded border border-solid border-command-border px-1 py-0.5"
            >
              <div className="flex items-center gap-1">
                <code className="min-w-0 flex-1 truncate" title={item.summary}>
                  {item.summary}
                </code>
                <span className="flex-shrink-0 text-error">
                  {decisionLabel({
                    outcome: "blocked",
                    source: item.source,
                    category: item.category,
                  })}
                </span>
                {canAllowOnce(item) &&
                  (item.allowedOnce ? (
                    <span className="flex-shrink-0 text-description-muted">
                      Allowed once. Ask the agent to try again.
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`allow-once-${item.id}`}
                      className="flex-shrink-0 cursor-pointer rounded border-none bg-lightgray/20 px-1 text-2xs text-foreground"
                      onClick={() => dispatch(allowBlockedOnce(item.id))}
                    >
                      Allow once
                    </button>
                  ))}
              </div>
              {item.reason && (
                <div className="whitespace-normal text-description-muted">
                  {item.reason}
                </div>
              )}
              {!canAllowOnce(item) && (
                <div className="text-description-muted">
                  Set by your rules or settings. Change them in config.yaml or
                  Settings &gt; Tools to allow this.
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="cursor-pointer self-start border-none bg-transparent text-2xs text-description underline"
            onClick={() => dispatch(clearBlockedCalls())}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
