import { beforeAll, expect, test } from "vitest";
import { ChunkWithoutID } from "../../index";
import { basicChunker } from "./basic.js";

beforeAll(() => {
  // So that llama tokenizer works
  process.env.NODE_ENV = "test";
});
test("should yield no chunks for empty content", async () => {
  const contents = "";
  const maxChunkSize = 10;
  const chunks: ChunkWithoutID[] = [];

  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(0);
});

test("should yield no chunks for whitespace-only content", async () => {
  const contents = "   \n\t\n  ";
  const maxChunkSize = 10;
  const chunks: ChunkWithoutID[] = [];

  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(0);
});

test("should yield a single chunk if whole content fits within the max size", async () => {
  const contents = "line1\nline2\nline3";
  const maxChunkSize = 100; // Large enough to fit the content

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(1);
  expect(chunks[0].content).toBe("line1\nline2\nline3\n");
  expect(chunks[0].startLine).toBe(0);
  expect(chunks[0].endLine).toBe(2);
});

test("should yield multiple chunks when content exceeds the max size", async () => {
  // Create a longer text that will naturally exceed the token limit
  const longLine =
    "This is a somewhat longer line of text that should contain more tokens than our limit allows.";
  const contents = `Short line 1\n${longLine}\nShort line 2\n${longLine}`;
  const maxChunkSize = 20; // Small enough to force chunking

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  // We expect multiple chunks with the appropriate line numbers
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks[0].startLine).toBe(0);

  // Verify the chunks contain the expected content
  const allContent = chunks.map((c) => c.content).join("");
  expect(allContent).toContain("Short line 1");
  expect(allContent).toContain(longLine);
  expect(allContent).toContain("Short line 2");
});

test("should break up very long individual lines", async () => {
  // Create text with a single very long line
  const veryLongLine =
    "This is an extremely long line of text that should definitely exceed our token limit by itself and force the chunker to include it as a separate chunk despite being too large.";
  const contents = `Short line\n${veryLongLine}\nAnother short line`;
  const maxChunkSize = 15; // Small enough that the long line must be its own chunk

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  // We should have at least 3 chunks (the short line, the long line, and another short line)
  expect(chunks.length).toBeGreaterThanOrEqual(3);

  // Check if the long line is in its own chunk
  const longLineChunk = chunks.find((chunk) =>
    chunk.content.includes(veryLongLine),
  );
  expect(longLineChunk).toBeDefined();
});

test("should handle content with empty lines", async () => {
  const contents = "line1\n\nline3\n\nline5";
  const maxChunkSize = 100; // Large enough for all content

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(1);
  expect(chunks[0].content).toContain("line1");
  expect(chunks[0].content).toContain("line3");
  expect(chunks[0].content).toContain("line5");
});

test("should handle content with just a single line", async () => {
  const contents = "just one line";
  const maxChunkSize = 100;

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(1);
  expect(chunks[0].content).toBe("just one line\n");
  expect(chunks[0].startLine).toBe(0);
  expect(chunks[0].endLine).toBe(0);
});

test("should handle very small max chunk size correctly", async () => {
  const contents = "a\nb\nc\nd";
  const maxChunkSize = 2; // Very small limit

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  // Each line should be in its own chunk
  expect(chunks.length).toBeGreaterThanOrEqual(4);
  expect(chunks[0].content).toBe("a\n");
  expect(chunks[1].content).toBe("b\n");
  expect(chunks[2].content).toBe("c\n");
  expect(chunks[3].content).toBe("d\n");
});

test("should handle content with varying complexity", async () => {
  // Create content with lines of different complexity/length
  const contents =
    "Short.\n" +
    "A bit longer line with some more words.\n" +
    "This is the longest line with many more words which should require more tokens to encode properly.\n" +
    "Back to shorter.";

  const maxChunkSize = 25; // Medium-sized limit

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  // We should have multiple chunks
  expect(chunks.length).toBeGreaterThan(1);

  // The content should be preserved across all chunks
  const allContent = chunks.map((c) => c.content).join("");
  expect(allContent).toContain("Short.");
  expect(allContent).toContain("A bit longer line");
  expect(allContent).toContain("This is the longest line");
  expect(allContent).toContain("Back to shorter.");
});

test("should handle content ending without a newline", async () => {
  const contents = "line1\nline2\nline3"; // No trailing newline
  const maxChunkSize = 100; // Large enough for all content

  const chunks: ChunkWithoutID[] = [];
  for await (const chunk of basicChunker(contents, maxChunkSize)) {
    chunks.push(chunk);
  }

  expect(chunks).toHaveLength(1);
  expect(chunks[0].content).toContain("line1");
  expect(chunks[0].content).toContain("line2");
  expect(chunks[0].content).toContain("line3");
  expect(chunks[0].startLine).toBe(0);
  expect(chunks[0].endLine).toBe(2);
});
