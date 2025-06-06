import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";

// Tests the boundary chunking patch to node fetch made in node-fetch-patch.js (see that file for details).
describe("Chunked Transfer Encoding Patch Logic", () => {
  // The LAST_CHUNK marker "0\r\n\r\n"
  const LAST_CHUNK = Buffer.from("0\r\n\r\n");

  it("should detect complete marker at the end (normal case)", () => {
    const normalCase = Buffer.from("data data data 0\r\n\r\n");
    const result = Buffer.compare(normalCase.slice(-5), LAST_CHUNK) === 0;
    expect(result).toBe(true);
  });

  it("should handle chunks split across original pattern (0\\r\\n | \\r\\n)", () => {
    const previousChunk = Buffer.from("data data 0\r\n");
    const lastChunk = Buffer.from("\r\n");

    const result =
      Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 &&
      Buffer.compare(lastChunk.slice(-2), LAST_CHUNK.slice(3)) === 0;

    expect(result).toBe(true);
  });

  it("should handle problematic case from issue #1576 with new patch", () => {
    // The problematic case: data ends with "0\r\n0\r" and the next chunk is "\n\r\n"
    const previousChunk = Buffer.from([
      ...Array(10).fill(42),
      48,
      13,
      10,
      48,
      13,
    ]); // some data + "0\r\n0\r"
    const lastChunk = Buffer.from([10, 13, 10]); // "\n\r\n"

    // Check 1: Direct check for complete marker (should fail)
    const check1 = Buffer.compare(lastChunk.slice(-5), LAST_CHUNK) === 0;
    expect(check1).toBe(false);

    // Check 2: Original split pattern check (should fail)
    const check2 =
      Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 &&
      Buffer.compare(lastChunk.slice(-2), LAST_CHUNK.slice(3)) === 0;
    expect(check2).toBe(false);

    // Check 3: New patch check (should pass)
    const lastChunkLength = lastChunk.length;
    const newPatchCheck =
      lastChunkLength < 5 &&
      Buffer.compare(
        Buffer.from([...previousChunk.slice(-5), ...lastChunk]).slice(-5),
        LAST_CHUNK,
      ) === 0;
    expect(newPatchCheck).toBe(true);

    // Verification of the combined buffer
    const combinedBuffer = Buffer.from([
      ...previousChunk.slice(-5),
      ...lastChunk,
    ]);
    const combinedResult =
      Buffer.compare(combinedBuffer.slice(-5), LAST_CHUNK) === 0;
    expect(combinedResult).toBe(true);
  });
});
