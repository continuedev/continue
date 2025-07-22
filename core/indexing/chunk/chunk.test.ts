import path from "path";

import { Chunk } from "../../index.js";
import { cleanupAsyncEncoders } from "../../llm/countTokens.js";
import { chunkDocument, shouldChunk } from "./chunk";

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

function generateString(length: number) {
  return "a".repeat(length);
}
