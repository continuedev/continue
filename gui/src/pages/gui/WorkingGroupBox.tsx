import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { Children, useEffect, useRef, useState } from "react";
import { AnimatedEllipsis } from "../../components/AnimatedEllipsis";

const AUTO_COLLAPSE_DELAY_MS = 10000;

interface WorkingGroupBoxProps {
  isActive: boolean;
  actionCount: number;
  collapsedSummary?: string;
  children: React.ReactNode;
}

export function WorkingGroupBox({
  isActive,
  actionCount,
  collapsedSummary,
  children,
}: WorkingGroupBoxProps) {
  const [open, setOpen] = useState(true);
  const [elapsedLabel, setElapsedLabel] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef(isActive);

  useEffect(() => {
    if (isActive) {
      // Re-open when a new working phase starts
      setOpen(true);
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      // Cancel any pending auto-collapse
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    } else if (prevActive.current && !isActive) {
      // Just finished – record elapsed time and schedule collapse
      if (startTimeRef.current) {
        const diff = Date.now() - startTimeRef.current;
        setElapsedLabel(`${(diff / 1000).toFixed(1)}s`);
        startTimeRef.current = null;
      }
      collapseTimerRef.current = setTimeout(
        () => setOpen(false),
        AUTO_COLLAPSE_DELAY_MS,
      );
    }
    prevActive.current = isActive;

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!open || !bodyScrollRef.current) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (!bodyScrollRef.current) {
        return;
      }
      bodyScrollRef.current.scrollTop = bodyScrollRef.current.scrollHeight;
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [children, open]);

  const actionLabel = actionCount === 1 ? "1 action" : `${actionCount} actions`;

  const title = isActive
    ? "Yuto is working on it"
    : elapsedLabel
      ? `Worked for ${elapsedLabel} · ${actionLabel}`
      : actionLabel;
  const headerTitle =
    !open && collapsedSummary ? `${title} · ${collapsedSummary}` : title;
  const timelineItems = Children.toArray(children);

  return (
    <div
      className="border-border bg-vsc-input-background/70 my-1 overflow-hidden rounded-lg border"
      data-testid="working-group-box"
    >
      {/* Header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="text-description hover:bg-vsc-input-background/40 flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-xs transition-colors"
      >
        <WrenchScrewdriverIcon
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            isActive ? "animate-pulse opacity-75" : "opacity-60"
          }`}
        />
        <span className="min-w-0 font-medium">
          <span
            className={`inline-flex max-w-full items-center gap-1 ${
              isActive ? "animate-wave text-link" : "text-description"
            }`}
          >
            <span className="truncate">{headerTitle}</span>
            {isActive && <AnimatedEllipsis />}
            {open ? (
              <ChevronDownIcon
                data-testid="working-group-box-chevron-down"
                className="h-3.5 w-3.5 flex-shrink-0 opacity-60"
              />
            ) : (
              <ChevronRightIcon
                data-testid="working-group-box-chevron-right"
                className="h-3.5 w-3.5 flex-shrink-0 opacity-60"
              />
            )}
          </span>
        </span>
      </button>

      {/* Collapsible body */}
      <div
        ref={bodyScrollRef}
        className={`transition-all duration-300 ease-in-out ${
          open
            ? "thin-scrollbar max-h-[45vh] overflow-y-auto opacity-80"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="relative pb-1">
          {timelineItems.map((child, index) => {
            const hasPrev = index > 0;
            const hasNext = index < timelineItems.length - 1;

            return (
              <div
                className="relative pb-1 pl-6 pr-1"
                data-testid={`working-group-box-timeline-item-${index}`}
                key={`working-group-box-timeline-item-${index}`}
              >
                {hasPrev && (
                  <span
                    aria-hidden="true"
                    data-testid="working-group-box-timeline-connector"
                    className="bg-[color:var(--vscode-descriptionForeground)]/55 pointer-events-none absolute left-[9px] top-0 h-[17px] w-px"
                  />
                )}
                {hasNext && (
                  <span
                    aria-hidden="true"
                    data-testid="working-group-box-timeline-connector"
                    className="bg-[color:var(--vscode-descriptionForeground)]/55 pointer-events-none absolute bottom-0 left-[9px] top-[17px] w-px"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="border-command-border bg-vsc-editor-background/90 pointer-events-none absolute left-1 top-3 h-2.5 w-2.5 rounded-full border border-solid"
                />
                {child}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
