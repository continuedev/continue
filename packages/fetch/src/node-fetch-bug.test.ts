import { Buffer } from "buffer";
import { EventEmitter } from "events";
import { describe, expect, it } from "vitest";

/**
 * This test reproduces the issue described in
 * https://github.com/node-fetch/node-fetch/issues/1576
 *
 * The issue is that node-fetch has a hard-coded assumption about how the end-of-chunked-response
 * marker (0\r\n\r\n) might be split across chunks. It only handles two specific cases:
 * 1. The entire marker is in the last chunk
 * 2. The marker is split exactly as [0\r\n] + [\r\n]
 *
 * However, in real-world scenarios, the marker can be split in other ways, causing
 * "Premature close" errors.
 */

describe("node-fetch chunked encoding bug", () => {
  // Mock the relevant portion of node-fetch's response handling
  const LAST_CHUNK = Buffer.from("0\r\n\r\n");

  function simulateChunkedResponseHandling(chunks: Buffer[]) {
    const socket = new EventEmitter();
    let previousChunk: Buffer | undefined;
    let properLastChunkReceived = false;

    // This is the problematic code from node-fetch
    const onData = (buf: Buffer) => {
      // Check if the entire marker is in the current chunk
      properLastChunkReceived = Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;

      // This is the limited assumption - it only handles one specific way the marker can be split
      if (!properLastChunkReceived && previousChunk) {
        properLastChunkReceived =
          Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) ===
            0 && Buffer.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0;
      }

      previousChunk = buf;
    };

    // Simulate receiving chunks
    chunks.forEach((chunk) => {
      onData(chunk);
      socket.emit("data", chunk);
    });

    return properLastChunkReceived;
  }

  // This is the improved code proposed in the GitHub issue by Treverix
  function simulateImprovedChunkedResponseHandling(chunks: Buffer[]) {
    const socket = new EventEmitter();
    let previousChunk: Buffer | undefined;
    let properLastChunkReceived = false;

    const onData = (buf: Buffer) => {
      // Check if the entire marker is in the current chunk
      properLastChunkReceived = Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;

      // More flexible handling of split markers
      if (!properLastChunkReceived && previousChunk) {
        if (buf.length < 5) {
          // Create a composite buffer from the end of previous chunk and the current chunk
          const composite = Buffer.from([...previousChunk.slice(-5), ...buf]);
          properLastChunkReceived =
            Buffer.compare(composite.slice(-5), LAST_CHUNK) === 0;
        }
      }

      previousChunk = buf;
    };

    // Simulate receiving chunks
    chunks.forEach((chunk) => {
      onData(chunk);
      socket.emit("data", chunk);
    });

    return properLastChunkReceived;
  }

  it("fails to detect end of chunked response when split in unexpected way", () => {
    // This is the case reported in the GitHub issue
    // previousChunk = [ (...), 0, 13, 10, 48, 13]
    // lastChunk = [ 10, 13, 10]
    // Where 13 = \r and 10 = \n
    const previousChunk = Buffer.from([0, 13, 10, 48, 13]);
    const lastChunk = Buffer.from([10, 13, 10]);

    // With the original implementation, it fails to detect the end marker
    const originalResult = simulateChunkedResponseHandling([
      previousChunk,
      lastChunk,
    ]);
    expect(originalResult).toBe(false);

    // With the improved implementation, it correctly detects the end marker
    const improvedResult = simulateImprovedChunkedResponseHandling([
      previousChunk,
      lastChunk,
    ]);
    expect(improvedResult).toBe(true);
  });

  it("handles various ways the end marker can be split", () => {
    // Test various ways the marker can be split across chunks
    const testCases = [
      // Case 1: [0] + [\r\n\r\n]
      [Buffer.from([0]), Buffer.from([13, 10, 13, 10])],

      // Case 2: [0\r] + [\n\r\n]
      [Buffer.from([0, 13]), Buffer.from([10, 13, 10])],

      // Case 3: [0\r\n] + [\r\n]
      [Buffer.from([0, 13, 10]), Buffer.from([13, 10])],

      // Case 4: [0\r\n\r] + [\n]
      [Buffer.from([0, 13, 10, 13]), Buffer.from([10])],

      // Case 5: [..., 0, \r, \n, \r] + [\n, ...]
      [Buffer.from([99, 0, 13, 10, 13]), Buffer.from([10, 99])],
    ];

    testCases.forEach((chunks, index) => {
      // The original implementation only handles case 3 correctly
      const originalResult = simulateChunkedResponseHandling(chunks);
      expect(originalResult).toBe(index === 2);

      // The improved implementation handles all cases
      const improvedResult = simulateImprovedChunkedResponseHandling(chunks);
      expect(improvedResult).toBe(true);
    });
  });
});
