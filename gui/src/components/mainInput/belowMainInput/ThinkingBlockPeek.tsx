// src/components/ThinkingBlockPeek.tsx
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowPathIcon,
  QueueListIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { AnimatedEllipsis } from "../../AnimatedEllipsis";
import StyledMarkdownPreview from "../../StyledMarkdownPreview";

const MarkdownWrapper = styled.div`
  & > div > *:first-child {
    margin-top: 0 !important;
  }
  & > div > *:last-child {
    margin-bottom: 0 !important;
  }
`;

type ThinkingTimelineStatus = "complete" | "active" | "queued";

export interface ThinkingTimelineItem {
  id: string;
  title: string;
  detail?: string;
  status: ThinkingTimelineStatus;
}

const MAX_TIMELINE_ITEMS = 6;

const DEFAULT_TIMELINE_LABELS = [
  "Reading your request and context",
  "Evaluating options and constraints",
  "Preparing the response",
];

function normalizeSignalText(input: string): string {
  return input
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/`+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleAndDetail(signal: string): { title: string; detail?: string } {
  if (signal.length <= 58) {
    return { title: signal };
  }

  return {
    title: `${signal.slice(0, 55).trimEnd()}...`,
    detail: signal,
  };
}

export function extractThinkingSignals(content: string): string[] {
  const uniqueByLower = new Set<string>();

  const fromLines = content
    .split(/\r?\n/)
    .map(normalizeSignalText)
    .filter(
      (line) =>
        line.length >= 8 &&
        !line.startsWith("```") &&
        !line.toLowerCase().startsWith("thinking content redacted"),
    )
    .filter((line) => {
      const key = line.toLowerCase();
      if (uniqueByLower.has(key)) {
        return false;
      }
      uniqueByLower.add(key);
      return true;
    });

  if (fromLines.length > 0) {
    return fromLines.slice(0, MAX_TIMELINE_ITEMS);
  }

  const fromSentences = (content.match(/[^.!?\n]+[.!?]?/g) ?? [])
    .map(normalizeSignalText)
    .filter((sentence) => sentence.length >= 12)
    .filter((sentence) => {
      const key = sentence.toLowerCase();
      if (uniqueByLower.has(key)) {
        return false;
      }
      uniqueByLower.add(key);
      return true;
    });

  return fromSentences.slice(0, MAX_TIMELINE_ITEMS);
}

export function buildThinkingTimeline(
  content: string,
  inProgress?: boolean,
): ThinkingTimelineItem[] {
  const extractedSignals = extractThinkingSignals(content);
  const hasSignals = extractedSignals.length > 0;
  const labels = hasSignals ? extractedSignals : DEFAULT_TIMELINE_LABELS;

  return labels.slice(0, MAX_TIMELINE_ITEMS).map((signal, index, arr) => {
    let status: ThinkingTimelineStatus = "complete";

    if (inProgress) {
      if (!hasSignals) {
        status = index === 0 ? "complete" : index === 1 ? "active" : "queued";
      } else {
        status = index === arr.length - 1 ? "active" : "complete";
      }
    }

    const { title, detail } = toTitleAndDetail(signal);
    return {
      id: `timeline-${index}`,
      title,
      detail,
      status,
    };
  });
}

function buildBreadcrumbs(
  timelineItems: ThinkingTimelineItem[],
  inProgress?: boolean,
): string[] {
  const focus = timelineItems[0]?.title ?? "Reasoning";
  const shortFocus =
    focus.length > 24 ? `${focus.slice(0, 21).trimEnd()}...` : focus;

  return ["Thinking", shortFocus, inProgress ? "Working" : "Completed"];
}

function TimelineStatusIcon({ status }: { status: ThinkingTimelineStatus }) {
  if (status === "complete") {
    return <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400" />;
  }

  if (status === "active") {
    return <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-blue-300" />;
  }

  return <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />;
}

interface ThinkingBlockPeekProps {
  content: string;
  redactedThinking?: string;
  index: number;
  prevItem: ChatHistoryItem | null;
  inProgress?: boolean;
  signature?: string;
  tokens?: number;
}

function ThinkingBlockPeek({
  content,
  redactedThinking,
  index,
  prevItem,
  inProgress,
  tokens,
}: ThinkingBlockPeekProps) {
  const [open, setOpen] = useState(!!inProgress);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("");
  const prevInProgress = useRef(!!inProgress);
  const scrollRef = useRef<HTMLDivElement>(null);

  const duplicateRedactedThinkingBlock =
    prevItem &&
    prevItem.message.role === "thinking" &&
    redactedThinking &&
    prevItem.message.redactedThinking;

  const timelineItems = useMemo(
    () => buildThinkingTimeline(content, inProgress),
    [content, inProgress],
  );

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(timelineItems, inProgress),
    [timelineItems, inProgress],
  );

  const completedCount = timelineItems.filter(
    (item) => item.status === "complete",
  ).length;
  const progressPercent = Math.round(
    (completedCount / Math.max(timelineItems.length, 1)) * 100,
  );
  const latestSignal =
    timelineItems[timelineItems.length - 1]?.title ?? "Thinking";

  // Auto-open while streaming, collapse when done (like Copilot)
  useEffect(() => {
    if (inProgress) {
      setOpen(true);
    } else if (prevInProgress.current) {
      // Was streaming, just finished → collapse
      setOpen(false);
    }
    prevInProgress.current = !!inProgress;
  }, [inProgress]);

  useEffect(() => {
    if (inProgress) {
      setStartTime(Date.now());
      setElapsedTime("");
    } else if (startTime) {
      const endTime = Date.now();
      const diff = endTime - startTime;
      setElapsedTime(`${(diff / 1000).toFixed(1)}s`);
    }
  }, [inProgress]);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (inProgress && open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, inProgress, open]);

  if (duplicateRedactedThinkingBlock) return null;

  const label = inProgress
    ? redactedThinking
      ? "Redacted Thinking"
      : "Thinking"
    : redactedThinking
      ? "Redacted Thinking"
      : elapsedTime
        ? `Thought for ${elapsedTime}${tokens ? ` · ${tokens} tokens` : ""}`
        : `Thinking${tokens ? ` · ${tokens} tokens` : ""}`;

  const visibilityLabel = inProgress
    ? `Live updates · ${timelineItems.length} events`
    : `${timelineItems.length} events captured`;

  return (
    <div className="thread-message">
      <div className="mt-1 px-4">
        <div
          className="border-command-border bg-vsc-editor-background/40 overflow-hidden rounded-lg border border-solid"
          data-testid="thinking-block-peek"
        >
          {/* Header row */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`thinking-block-content-${index}`}
            onClick={() => setOpen((p) => !p)}
            className="text-description hover:bg-vsc-input-background/60 flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-xs transition-colors"
          >
            <SparklesIcon
              className={`h-3.5 w-3.5 flex-shrink-0 transition-opacity ${inProgress ? "animate-pulse opacity-70" : "opacity-50"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-description-muted mb-0.5 flex items-center gap-1 overflow-hidden text-[10px] uppercase tracking-wide">
                <QueueListIcon className="h-3 w-3 flex-shrink-0" />
                {breadcrumbs.map((crumb, crumbIndex) => (
                  <div
                    key={`${crumb}-${crumbIndex}`}
                    className="flex min-w-0 items-center gap-1"
                  >
                    {crumbIndex > 0 && (
                      <ChevronRightIcon className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className="truncate">{crumb}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {label}
                  {inProgress && <AnimatedEllipsis />}
                </span>
                <span className="text-description-muted hidden md:inline">
                  {visibilityLabel}
                </span>
              </div>
            </div>
            <span className="text-description-muted hidden text-[11px] sm:inline">
              {inProgress ? "Live" : `${progressPercent}%`}
            </span>
            {open ? (
              <ChevronUpIcon className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
            )}
          </button>

          {/* Collapsible body */}
          <div
            id={`thinking-block-content-${index}`}
            className={`border-command-border transition-all duration-200 ease-in-out ${
              open
                ? "max-h-[40vh] opacity-100"
                : "max-h-0 overflow-hidden opacity-0"
            }`}
          >
            <div
              className="border-command-border thin-scrollbar max-h-[40vh] overflow-y-auto border-t border-solid px-3 py-2.5"
              ref={scrollRef}
            >
              <div className="border-command-border/70 bg-vsc-input-background/30 mb-3 rounded-md border border-solid px-2.5 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-description text-[11px] font-semibold">
                    Reasoning Timeline
                  </span>
                  <span className="text-description-muted text-[11px]">
                    {inProgress
                      ? "Updating now"
                      : `Completed · ${progressPercent}%`}
                  </span>
                </div>
                <ol className="m-0 list-none space-y-1 p-0">
                  {timelineItems.map((item, itemIndex) => (
                    <li key={item.id} className="relative flex gap-2 pl-0.5">
                      {itemIndex < timelineItems.length - 1 && (
                        <span className="border-command-border absolute left-[7px] top-4 h-[calc(100%-8px)] border-l border-solid opacity-70" />
                      )}
                      <span className="mt-0.5 flex-shrink-0">
                        <TimelineStatusIcon status={item.status} />
                      </span>
                      <div className="min-w-0 pb-1.5">
                        <p className="text-description m-0 text-xs font-medium">
                          {item.title}
                        </p>
                        {item.detail && (
                          <p className="text-description-muted m-0 mt-0.5 text-[11px]">
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-description-muted border-command-border m-0 mt-1 border-0 border-t border-solid pt-1.5 text-[11px]">
                  {inProgress
                    ? `Latest signal: ${latestSignal}`
                    : `Reasoning finished in ${elapsedTime || "0.0s"}.`}
                </p>
              </div>

              {redactedThinking ? (
                <p className="text-description m-0 text-xs italic">
                  Thinking content redacted due to safety reasons.
                </p>
              ) : (
                <MarkdownWrapper>
                  <StyledMarkdownPreview
                    isRenderingInStepContainer
                    source={content}
                    itemIndex={index}
                  />
                </MarkdownWrapper>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThinkingBlockPeek;
