// src/components/ThinkingBlockPeek.tsx
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
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

function normalizeDeduplicationKey(input: string): string {
  return normalizeSignalText(input)
    .toLowerCase()
    .replace(/[.:;,!?]+$/, "");
}

export function dedupeRepeatedThinkingContent(content: string): string {
  const dedupedLines: string[] = [];
  const seenNarrativeKeys = new Set<string>();
  const lines = content.split(/\r?\n/);
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      dedupedLines.push(line);
      continue;
    }

    if (inCodeFence) {
      dedupedLines.push(line);
      continue;
    }

    if (!trimmed) {
      if (
        dedupedLines.length > 0 &&
        dedupedLines[dedupedLines.length - 1].trim() !== ""
      ) {
        dedupedLines.push("");
      }
      continue;
    }

    const normalizedKey = normalizeDeduplicationKey(trimmed);
    const isStructuredLine =
      /^[-*+]\s+/.test(trimmed) ||
      /^\d+[.)]\s+/.test(trimmed) ||
      /^#{1,6}\s+/.test(trimmed) ||
      normalizedKey.length >= 24;

    if (isStructuredLine && seenNarrativeKeys.has(normalizedKey)) {
      continue;
    }

    if (isStructuredLine) {
      seenNarrativeKeys.add(normalizedKey);
    }

    dedupedLines.push(line);
  }

  while (
    dedupedLines.length > 0 &&
    dedupedLines[dedupedLines.length - 1].trim() === ""
  ) {
    dedupedLines.pop();
  }

  return dedupedLines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function extractThinkingSignals(content: string): string[] {
  const dedupedContent = dedupeRepeatedThinkingContent(content);
  const uniqueByLower = new Set<string>();

  const fromLines = dedupedContent
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

  const fromSentences = (dedupedContent.match(/[^.!?\n]+[.!?]?/g) ?? [])
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

    const context = inferTimelineContext(signal);
    return {
      id: `timeline-${index}`,
      title: signal,
      status,
      context,
    };
  });
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

  const renderedThinkingContent = useMemo(
    () => dedupeRepeatedThinkingContent(content),
    [content],
  );

  const timelineItems = useMemo(
    () => buildThinkingTimeline(renderedThinkingContent, inProgress),
    [renderedThinkingContent, inProgress],
  );
  const latestSignal = timelineItems[timelineItems.length - 1]?.title;

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

  const statusLine = label;

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
              className={`h-3.5 w-3.5 flex-shrink-0 ${
                inProgress ? "animate-pulse opacity-75" : "opacity-60"
              }`}
            />

            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {statusLine}
                {inProgress && <AnimatedEllipsis />}
              </div>
              {inProgress && latestSignal && (
                <div className="text-description-muted mt-0.5 truncate text-[10px]">
                  {latestSignal}
                </div>
              )}
            </div>

            {open ? (
              <ChevronUpIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
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
              {redactedThinking ? (
                <p className="text-description m-0 mt-2 text-xs italic">
                  Thinking content redacted due to safety reasons.
                </p>
              ) : (
                <div className="mt-1">
                  <MarkdownWrapper>
                    <StyledMarkdownPreview
                      isRenderingInStepContainer
                      source={renderedThinkingContent}
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
