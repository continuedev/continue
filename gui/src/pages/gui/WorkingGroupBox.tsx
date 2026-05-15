import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import { AnimatedEllipsis } from "../../components/AnimatedEllipsis";

const AUTO_COLLAPSE_DELAY_MS = 3000;

interface WorkingGroupBoxProps {
  isActive: boolean;
  actionCount: number;
  children: React.ReactNode;
}

export function WorkingGroupBox({
  isActive,
  actionCount,
  children,
}: WorkingGroupBoxProps) {
  const [open, setOpen] = useState(true);
  const [elapsedLabel, setElapsedLabel] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const actionLabel = actionCount === 1 ? "1 action" : `${actionCount} actions`;

  const title = isActive
    ? "Yuto is working on it"
    : elapsedLabel
      ? `Worked for ${elapsedLabel} · ${actionLabel}`
      : actionLabel;

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
        <span className="wave min-w-0 flex-1 font-medium">
          {title}
          {isActive && <AnimatedEllipsis />}
        </span>
        {open ? (
          <ChevronUpIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        )}
      </button>

      {/* Collapsible body */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          open
            ? "thin-scrollbar max-h-[45vh] overflow-y-auto opacity-80"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="pb-1">{children}</div>
      </div>
    </div>
  );
}
