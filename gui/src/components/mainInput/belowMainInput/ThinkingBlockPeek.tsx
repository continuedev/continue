// src/components/ThinkingBlockPeek.tsx
import {
  BeakerIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ClockIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/solid";
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
type ThinkingTimelineContext =
  | "read"
  | "search"
  | "run"
  | "edit"
  | "test"
  | "tool"
  | "plan";

export interface ThinkingTimelineItem {
  id: string;
  title: string;
  detail?: string;
  status: ThinkingTimelineStatus;
  context: ThinkingTimelineContext;
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

export function inferTimelineContext(signal: string): ThinkingTimelineContext {
  const normalized = signal.toLowerCase();

  if (
    /(\btest\b|\bvitest\b|\bjest\b|\bspec\b|assert|coverage)/.test(normalized)
  ) {
    return "test";
  }

  if (
    /(search|grep|\brg\b|ripgrep|\bfind\b|query|lookup|locat)/.test(normalized)
  ) {
    return "search";
  }

  if (
    /(\bread\b|review|inspect|\bopen\b|\bcat\b|\.log\b|\.jsonl\b)/.test(
      normalized,
    )
  ) {
    return "read";
  }

  if (
    /(\brun\b|\bran\b|execute|executed|terminal|command|\bnpm\b|\bpnpm\b|\byarn\b|\bnode\b|\bpython\b)/.test(
      normalized,
    )
  ) {
    return "run";
  }

  if (
    /(\bedit\b|update|updated|patch|apply_patch|modify|refactor|implement|rewrite|insert|delete)/.test(
      normalized,
    )
  ) {
    return "edit";
  }

  if (
    /(tool|mcp|function call|preprocessargs|extension host|agent\/run)/.test(
      normalized,
    )
  ) {
    return "tool";
  }

  return "plan";
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
    const context = inferTimelineContext(signal);
    return {
      id: `timeline-${index}`,
      title,
      detail,
      status,
      context,
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

function TimelineStepIcon({
  status,
  context,
}: {
  status: ThinkingTimelineStatus;
  context: ThinkingTimelineContext;
}) {
  const contextIconByType: Record<
    ThinkingTimelineContext,
    typeof DocumentTextIcon
  > = {
    read: DocumentTextIcon,
    search: MagnifyingGlassIcon,
    run: CommandLineIcon,
    edit: CodeBracketIcon,
    test: BeakerIcon,
    tool: WrenchScrewdriverIcon,
    plan: SparklesIcon,
  };

  const ContextIcon = contextIconByType[context];

  const statusContainerClass =
    status === "complete"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : status === "active"
        ? "border-blue-400/50 bg-blue-500/10"
        : "border-command-border/60 bg-vsc-input-background/30";

  const statusBadgeClass =
    status === "complete"
      ? "bg-emerald-400"
      : status === "active"
        ? "bg-blue-300"
        : "bg-zinc-500";

  return (
    <span
      className={`relative flex h-5 w-5 items-center justify-center rounded-md border border-solid ${statusContainerClass}`}
    >
      <ContextIcon
        className={`h-3 w-3 ${status === "active" ? "animate-pulse" : ""}`}
      />
      <span
        className={`border-vsc-editor-background absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-solid ${statusBadgeClass}`}
      />
    </span>
  );
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

  const statusLine = inProgress
    ? `${label} · ${timelineItems.length} events`
    : label;

  return (
    <div className="thread-message">
      <div className="mt-1 px-4">
        <div className="overflow-hidden" data-testid="thinking-block-peek">
          {/* Header row */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`thinking-block-content-${index}`}
            onClick={() => setOpen((p) => !p)}
            className="text-description hover:bg-vsc-input-background/40 flex w-full items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-left text-xs transition-colors"
          >
            <SparklesIcon
              className={`h-3.5 w-3.5 flex-shrink-0 transition-opacity ${inProgress ? "animate-pulse opacity-70" : "opacity-50"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-description-muted mb-0.5 flex items-center gap-1 overflow-hidden text-[10px]">
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
              <div className="flex items-center">
                <span className="font-medium">
                  {statusLine}
                  {inProgress && <AnimatedEllipsis />}
                </span>
              </div>
            </div>
            {open ? (
              <ChevronUpIcon className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
            )}
          </button>

          {/* Collapsible body */}
          <div
            id={`thinking-block-content-${index}`}
            className={`transition-all duration-200 ease-in-out ${
              open
                ? "max-h-[36vh] opacity-100"
                : "max-h-0 overflow-hidden opacity-0"
            }`}
          >
            <div
              className="thin-scrollbar max-h-[36vh] overflow-y-auto pb-1 pl-6 pr-1 pt-1"
              ref={scrollRef}
            >
              <ol className="m-0 list-none space-y-1.5 p-0">
                {timelineItems.map((item, itemIndex) => (
                  <li key={item.id} className="relative flex gap-2 pl-0.5">
                    {itemIndex < timelineItems.length - 1 && (
                      <span className="border-command-border/60 absolute left-[10px] top-5 h-[calc(100%-10px)] border-l border-solid" />
                    )}
                    <span className="mt-0.5 flex-shrink-0">
                      <TimelineStepIcon
                        status={item.status}
                        context={item.context}
                      />
                    </span>
                    <div className="min-w-0 pb-1.5">
                      <p className="text-description m-0 flex items-center gap-1 text-xs font-medium">
                        {item.title}
                        {item.status === "active" && (
                          <ArrowPathIcon className="h-3 w-3 animate-spin text-blue-300" />
                        )}
                        {item.status === "complete" && (
                          <CheckCircleIcon className="h-3 w-3 text-emerald-400" />
                        )}
                        {item.status === "queued" && (
                          <ClockIcon className="h-3 w-3 text-zinc-400" />
                        )}
                      </p>
                      {item.detail && (
                        <p className="text-description-muted m-0 mt-0.5 text-[11px] leading-4">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {redactedThinking ? (
                <p className="text-description m-0 mt-2 text-xs italic">
                  Thinking content redacted due to safety reasons.
                </p>
              ) : (
                <div className="border-command-border/40 mt-2 border-0 border-l border-solid pl-3">
                  <MarkdownWrapper>
                    <StyledMarkdownPreview
                      isRenderingInStepContainer
                      source={content}
                      itemIndex={index}
                    />
                  </MarkdownWrapper>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThinkingBlockPeek;
