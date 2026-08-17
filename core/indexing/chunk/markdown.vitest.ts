import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/countTokens", () => ({
  countTokens: (content: string) => content.length,
  countTokensAsync: async (content: string) => content.length,
}));

import { ChunkWithoutID } from "../../index";

import { markdownChunker } from "./markdown";

async function collectChunks(
  content: string,
  maxChunkSize: number,
  hLevel: number,
): Promise<ChunkWithoutID[]> {
  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of markdownChunker(content, maxChunkSize, hLevel)) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("markdownChunker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not prefix chunks with 'undefined' when a section has no header", async () => {
    const content = Array.from(
      { length: 10 },
      (_, i) => `Line ${i} of a markdown document that has no headers at all.`,
    ).join("\n");

    const chunks = await collectChunks(content, 100, 0);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content).not.toContain("undefined");
    }
  });

  it("should not prefix headerless sub-sections with 'undefined'", async () => {
    const content = [
      "## Installation",
      ...Array.from(
        { length: 10 },
        (_, i) => `Installation step ${i} with a bit of extra detail.`,
      ),
    ].join("\n");

    const chunks = await collectChunks(content, 120, 1);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content).not.toContain("undefined");
      expect(chunk.content.startsWith("## Installation\n")).toBe(true);
    }
  });

  it("should still prepend the section header to each chunk", async () => {
    const content = [
      "## Installation",
      ...Array.from(
        { length: 10 },
        (_, i) => `Installation step ${i} with a bit of extra detail.`,
      ),
    ].join("\n");

    const chunks = await collectChunks(content, 120, 1);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.otherMetadata?.title).toBe("Installation");
    }
  });
});
