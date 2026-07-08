import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopAfterMaxProcessingTime } from "./utils";

describe("stopAfterMaxProcessingTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function* createMockStream(chunks: string[]): AsyncGenerator<string> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async function streamToString(
    stream: AsyncGenerator<string>,
  ): Promise<string> {
    let result = "";
    for await (const chunk of stream) {
      result += chunk;
    }
    return result;
  }

  it("should yield all chunks when maxTimeMs is not reached", async () => {
    const mockStream = createMockStream(["Hello", " world", "!"]);
    const fullStop = vi.fn();
    const result = stopAfterMaxProcessingTime(mockStream, 1000, fullStop);

    const output = await streamToString(result);

    expect(output).toBe("Hello world!");
    expect(fullStop).not.toHaveBeenCalled();
  });

  it("should stop processing after max time is reached", async () => {
    // Mock implementation of Date.now
    let currentTime = 0;
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => currentTime);

    // Create a generator that we can control
    async function* controlledGenerator(): AsyncGenerator<string> {
      for (let i = 0; i < 100; i++) {
        // After yielding 10 chunks, simulate time passing beyond our limit
        if (i === 10) {
          currentTime = 1000; // This exceeds our 500ms limit
        }
        yield `chunk-${i}`;
      }
    }

    const fullStop = vi.fn();
    const maxTimeMs = 500;

    const transformedGenerator = stopAfterMaxProcessingTime(
      controlledGenerator(),
      maxTimeMs,
      fullStop,
    );

    // Consume the generator and collect outputs
    const outputs: string[] = [];
    for await (const chunk of transformedGenerator) {
      outputs.push(chunk);
    }

    // We expect:
    // 1. Not all chunks were processed (less than 100)
    // 2. fullStop was called
    // 3. We processed at least the chunks before time was exceeded
    expect(outputs.length).toBeLessThan(100);
    expect(outputs.length).toBeGreaterThanOrEqual(10); // We should get at least the first 10 chunks
    expect(fullStop).toHaveBeenCalled();

    // Restore Date.now
    Date.now = originalDateNow;
  });

  it("should check time only periodically based on checkInterval", async () => {
    const chunks = Array(100).fill("x");
    const mockStream = createMockStream(chunks);
    const fullStop = vi.fn();

    // Spy on Date.now to count how many times it's called
    const dateSpy = vi.spyOn(Date, "now");

    // Stream should complete normally (not hitting the timeout)
    await streamToString(
      stopAfterMaxProcessingTime(mockStream, 10000, fullStop),
    );

    // The first call is to set startTime, then once every checkInterval (10) chunks
    // So for 100 chunks, we expect startTime + ~10 checks = ~11 calls
    // We use a range because implementation details might vary slightly
    expect(dateSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(dateSpy.mock.calls.length).toBeLessThanOrEqual(15);

    dateSpy.mockRestore();
  });

  it("should handle empty stream gracefully", async () => {
    const mockStream = createMockStream([]);
    const fullStop = vi.fn();
    const result = stopAfterMaxProcessingTime(mockStream, 1000, fullStop);

    const output = await streamToString(result);

    expect(output).toBe("");
    expect(fullStop).not.toHaveBeenCalled();
  });

  it("should pass through all chunks if there's no timeout", async () => {
    const chunks = Array(100).fill("test chunk");
    const mockStream = createMockStream(chunks);
    const fullStop = vi.fn();

    // Use undefined as timeout to simulate no timeout
    const result = stopAfterMaxProcessingTime(
      mockStream,
      undefined as any,
      fullStop,
    );

    // Process the stream
    const processedChunks = [];
    for await (const chunk of result) {
      processedChunks.push(chunk);
    }

    expect(processedChunks.length).toBe(chunks.length);
    expect(fullStop).not.toHaveBeenCalled();
  });
});
