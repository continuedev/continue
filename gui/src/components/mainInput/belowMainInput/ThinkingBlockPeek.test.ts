import { describe, expect, it } from "vitest";
import {
  buildThinkingTimeline,
  dedupeRepeatedThinkingContent,
  extractThinkingSignals,
  inferTimelineContext,
} from "./ThinkingBlockPeek";

describe("ThinkingBlockPeek timeline helpers", () => {
  it("extracts unique thinking signals from markdown-like content", () => {
    const content = `
## Exploring locking mechanisms
- Inspect env directory and mailbox state
- Add lock helper and retry flow
- Add lock helper and retry flow
`;

    const signals = extractThinkingSignals(content);

    expect(signals).toContain("Exploring locking mechanisms");
    expect(signals).toContain("Inspect env directory and mailbox state");
    expect(signals).toContain("Add lock helper and retry flow");
    expect(
      signals.filter((s) => s === "Add lock helper and retry flow"),
    ).toHaveLength(1);
  });

  it("marks the latest signal as active while thinking is in progress", () => {
    const content = `
- Read startup logs
- Inspect crate structure
- Produce findings report
`;

    const timeline = buildThinkingTimeline(content, true);

    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline[timeline.length - 1].status).toBe("active");
    expect(
      timeline.slice(0, -1).every((item) => item.status === "complete"),
    ).toBe(true);
  });

  it("falls back to default timeline stages when content has no parseable signals", () => {
    const timeline = buildThinkingTimeline("   ", true);

    expect(timeline).toHaveLength(3);
    expect(timeline.some((item) => item.status === "active")).toBe(true);
    expect(timeline.some((item) => item.status === "queued")).toBe(true);
  });

  it("marks all stages complete once thinking has finished", () => {
    const timeline = buildThinkingTimeline("Plan. Execute. Verify.", false);

    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.every((item) => item.status === "complete")).toBe(true);
  });

  it("caps extracted timeline events to a stable maximum", () => {
    const content = Array.from(
      { length: 20 },
      (_, index) => `- signal ${index + 1}`,
    ).join("\n");

    const timeline = buildThinkingTimeline(content, true);

    expect(timeline.length).toBeLessThanOrEqual(6);
  });

  it("infers timeline context from common tooling actions", () => {
    expect(
      inferTimelineContext("Read renderer.log and inspect stack trace"),
    ).toBe("read");
    expect(
      inferTimelineContext("Searched for regex patterns in core/llm"),
    ).toBe("search");
    expect(inferTimelineContext("Ran npm run build")).toBe("run");
    expect(inferTimelineContext("Updated Chat.tsx with apply_patch")).toBe(
      "edit",
    );
    expect(inferTimelineContext("Vitest suite passed")).toBe("test");
    expect(inferTimelineContext("tools/preprocessArgs returned error")).toBe(
      "tool",
    );
    expect(inferTimelineContext("Evaluating options and constraints")).toBe(
      "plan",
    );
  });

  it("deduplicates repeated planning blocks while preserving new details", () => {
    const content = `
The file is 456 lines. I need to extract helpers from it.
- buildCompletionOptions - building LLM completion options with tools and reasoning
- buildMessages - constructing system message and chat messages
- collectTelemetryData - the devdata logging

The file is 456 lines. I need to extract helpers from it.
- buildCompletionOptions - building LLM completion options with tools and reasoning
- buildMessages - constructing system message and chat messages
- collectTelemetryData - the devdata logging
- executeToolCallPipeline - the post-stream tool call handling (steps 1-4 at the end)
`;

    const deduped = dedupeRepeatedThinkingContent(content);

    expect(
      deduped.match(
        /The file is 456 lines\. I need to extract helpers from it\./g,
      ),
    ).toHaveLength(1);
    expect(
      deduped.match(
        /buildCompletionOptions - building LLM completion options/g,
      ),
    ).toHaveLength(1);
    expect(deduped).toContain(
      "executeToolCallPipeline - the post-stream tool call handling (steps 1-4 at the end)",
    );
  });
});
