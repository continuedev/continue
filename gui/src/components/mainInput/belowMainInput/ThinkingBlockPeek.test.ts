import { describe, expect, it } from "vitest";
import {
  buildThinkingTimeline,
  extractThinkingSignals,
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
});
