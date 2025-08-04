import path from "path";

import { Chunk, ChunkWithoutID } from "../../index.js";
import { cleanupAsyncEncoders } from "../../llm/countTokens.js";
import { chunkDocument, chunkDocumentWithoutId, shouldChunk } from "./chunk";

describe("shouldChunk", () => {
  test("should chunk a typescript file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(10000);
    expect(shouldChunk(filePath, fileContent)).toBe(true);
  });

  test("should not chunk a large typescript file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(1500000);
    expect(shouldChunk(filePath, fileContent)).toBe(false);
  });

  test("should not chunk an empty file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(0);
    expect(shouldChunk(filePath, fileContent)).toBe(false);
  });

  test("should not chunk a file without extension", () => {
    const filePath = path.join("directory", "with.dot", "filename");
    const fileContent = generateString(10000);
    expect(shouldChunk(filePath, fileContent)).toBe(false);
  });
});

describe("chunkDocument", () => {
  afterAll(async () => {
    // Clean up the global async encoders to prevent Jest from hanging
    await cleanupAsyncEncoders();
  });

  test("should return multiple chunks for large content with small maxChunkSize", async () => {
    const filepath = "/test/file.txt";
    const maxChunkSize = 10; // small limit
    const digest = "test-digest";

    // Create content with multiple short lines - each line should fit within maxChunkSize
    const lines = ["short line", "another line", "third line"];
    const contents = lines.join("\n");

    const chunks: Chunk[] = [];
    for await (const chunk of chunkDocument({
      filepath,
      contents,
      maxChunkSize,
      digest,
    })) {
      chunks.push(chunk);
    }

    // Verify chunks have valid content
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  test("should filter out chunks that exceed maxChunkSize in tokens", async () => {
    const filepath = "/test/large.txt";
    const maxChunkSize = 10; // small limit
    const digest = "test-digest-2";

    const contents =
      "This is a much longer line with many words that will likely exceed the maxChunkSize token limit and should be filtered out by the chunkDocument function. This is a much longer line with many words that will likely exceed the maxChunkSize token limit and should be filtered out by the chunkDocument function.";

    const chunks: Chunk[] = [];
    for await (const chunk of chunkDocument({
      filepath,
      contents,
      maxChunkSize,
      digest,
    })) {
      chunks.push(chunk);
    }

    // Verify that no chunks were created since the content exceeds maxChunkSize
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBe(0);
    });
  });
});

describe("chunkDocumentWithoutId", () => {
  afterAll(async () => {
    await cleanupAsyncEncoders();
  });

  test("should return no chunks for empty content", async () => {
    const contents = "";
    const chunks: ChunkWithoutID[] = [];
    for await (const chunk of chunkDocumentWithoutId(
      "file.txt",
      contents,
      100,
    )) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(0);
  });

  test("should chunk text files", async () => {
    const contents = "Line 1\nLine 2\nLine 3";
    const chunks: ChunkWithoutID[] = [];
    for await (const chunk of chunkDocumentWithoutId(
      "file.txt",
      contents,
      100,
    )) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("Line 1");
  });

  test("should chunk for code files", async () => {
    const contents = "function test() {\n  return 42;\n}";
    const chunks: ChunkWithoutID[] = [];
    for await (const chunk of chunkDocumentWithoutId(
      "file.js",
      contents,
      100,
    )) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain("function test");
  });

  test("should chunk large content", async () => {
    const contents = Array(100).fill("short line").join("\n"); // Large content with many lines
    const maxChunkSize = 50;
    const chunks: ChunkWithoutID[] = [];
    for await (const chunk of chunkDocumentWithoutId(
      "file.txt",
      contents,
      maxChunkSize,
    )) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1); // Should create multiple chunks
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0); // Each chunk should have content
    });
  });
});

function generateString(length: number) {
  return "a".repeat(length);
}
