import fsPromises from "fs/promises";
import os from "os";
import * as path from "path";

import {
  buildConsolidatedMemoryFile,
  evaluateAutoDreamScanGate,
  hasEnoughAutoDreamSessions,
} from "core/agent/memoryLifecycle/autoDream.js";
import { stripMarkdownFrontmatter } from "core/agent/memoryLifecycle/markdown.js";
import {
  buildSessionMemoryFile,
  shouldExtractSessionMemoryGate,
} from "core/agent/memoryLifecycle/sessionMemory.js";
import {
  createSessionMemoryState,
  extractSessionMemory,
} from "core/agent/SessionMemory.js";
import { describe, expect, it } from "vitest";

describe("memory lifecycle helpers", () => {
  it("wraps and strips session memory frontmatter without altering markdown", () => {
    const markdown = "# Current State\nImplement the shared memory lifecycle.";
    const fileContent = buildSessionMemoryFile({
      sessionId: "session-123",
      markdown,
      totalToolCalls: 4,
      updatedAt: 0,
      source: "continue-cli",
    });

    expect(fileContent).toContain("type: session-memory");
    expect(fileContent).toContain("session_id: session-123");
    expect(stripMarkdownFrontmatter(fileContent)).toBe(markdown);
  });

  it("requires init threshold, token growth, and tool calls before extracting", () => {
    expect(
      shouldExtractSessionMemoryGate({
        extracting: true,
        initialized: true,
        currentTokens: 20_000,
        tokensAtLastExtraction: 10_000,
        toolCallsSinceExtraction: 5,
        config: {
          minimumMessageTokensToInit: 10_000,
          minimumTokensBetweenUpdate: 5_000,
          toolCallsBetweenUpdates: 3,
        },
      }),
    ).toBe(false);
  });

  it("evaluates autodream scan gates and session thresholds", () => {
    expect(
      evaluateAutoDreamScanGate({
        lastConsolidatedAt: Date.now(),
        lastScanAt: 0,
        config: { minHours: 24 },
      }),
    ).toEqual({ ready: false, blockedBy: "time" });

    expect(
      evaluateAutoDreamScanGate({
        lastConsolidatedAt: Date.now() - 48 * 60 * 60 * 1000,
        lastScanAt: Date.now(),
        config: { scanThrottleMs: 10 * 60 * 1000 },
      }),
    ).toEqual({ ready: false, blockedBy: "throttle" });

    expect(
      evaluateAutoDreamScanGate({
        lastConsolidatedAt: Date.now() - 48 * 60 * 60 * 1000,
        lastScanAt: 0,
      }),
    ).toEqual({ ready: true });

    expect(hasEnoughAutoDreamSessions(4, { minSessions: 5 })).toBe(false);
    expect(hasEnoughAutoDreamSessions(5, { minSessions: 5 })).toBe(true);
  });

  it("wraps consolidated memory with source session metadata", () => {
    const markdown = "## Preferences\n- Prefer focused validation commands.";
    const fileContent = buildConsolidatedMemoryFile({
      markdown,
      sessionFiles: ["/tmp/session-a.md", "/tmp/session-b.md"],
      updatedAt: 0,
      source: "continue-cli",
    });

    expect(fileContent).toContain("type: long-term-memory");
    expect(fileContent).toContain("source_sessions:");
    expect(fileContent).toContain("- session-a");
    expect(stripMarkdownFrontmatter(fileContent)).toBe(markdown);
  });
});

describe("core session memory extraction", () => {
  it("keeps extracting true until the background extraction finishes", async () => {
    const tempDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), "session-memory-"),
    );

    try {
      let releaseStream: (() => void) | null = null;
      const streamGate = new Promise<void>((resolve) => {
        releaseStream = resolve;
      });

      const llm = {
        async *streamChat() {
          await streamGate;
          yield { content: "X".repeat(140) };
        },
      } as any;

      const state = createSessionMemoryState("session-1", {
        sessionDir: tempDir,
        minimumMessageTokensToInit: 0,
        minimumTokensBetweenUpdate: 0,
        toolCallsBetweenUpdates: 0,
      });

      const messages = [
        {
          role: "assistant",
          content: "A".repeat(400),
          toolCalls: [
            { id: "tool-1", function: { name: "Read", arguments: "{}" } },
          ],
        },
      ] as any;

      const extractingState = await extractSessionMemory(state, messages, llm);

      expect(extractingState.extracting).toBe(true);

      releaseStream?.();

      for (
        let attempt = 0;
        attempt < 20 && extractingState.extracting;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      expect(extractingState.extracting).toBe(false);

      const written = await fsPromises.readFile(
        path.join(tempDir, "session-1.md"),
        "utf-8",
      );
      expect(written).toContain("type: session-memory");
      expect(stripMarkdownFrontmatter(written)).toContain("X");
    } finally {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
  });
});
