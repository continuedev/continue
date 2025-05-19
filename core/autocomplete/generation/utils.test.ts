import { jest } from "@jest/globals";
import { stopAfterMaxProcessingTime } from "./utils";

describe("stopAfterMaxProcessingTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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
    const fullStop = jest.fn();
    const result = stopAfterMaxProcessingTime(mockStream, 1000, fullStop);

    const output = await streamToString(result);

    expect(output).toBe("Hello world!");
    expect(fullStop).not.toHaveBeenCalled();
  });

  it("should stop processing after max time is reached", async () => {
    // Create a stream that will take some time to process
    const chunks = Array(50).fill("chunk");
    const mockStream = createMockStream(chunks);
    const fullStop = jest.fn();

    // Set up Date.now to simulate time passing
    let currentTime = 0;
    jest.spyOn(Date, "now").mockImplementation(() => {
      currentTime += 100; // Each call advances time by 100ms
      return currentTime;
    });

    const result = stopAfterMaxProcessingTime(mockStream, 500, fullStop);

    // Consume the stream
    const output = [];
    try {
      for await (const chunk of result) {
        output.push(chunk);
      }
    } catch (e) {
      // Ignore any errors from early termination
    }

    // Should have been terminated before processing all chunks
    expect(output.length).toBeLessThan(chunks.length);
    expect(fullStop).toHaveBeenCalled();

    // Restore original Date.now
    jest.spyOn(Date, "now").mockRestore();
  });

  it("should check time only periodically based on checkInterval", async () => {
    const chunks = Array(100).fill("x");
    const mockStream = createMockStream(chunks);
    const fullStop = jest.fn();

    // Spy on Date.now to count how many times it's called
    const dateSpy = jest.spyOn(Date, "now");

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
    const fullStop = jest.fn();
    const result = stopAfterMaxProcessingTime(mockStream, 1000, fullStop);

    const output = await streamToString(result);

    expect(output).toBe("");
    expect(fullStop).not.toHaveBeenCalled();
  });

  it("should pass through all chunks if there's no timeout", async () => {
    const chunks = Array(100).fill("test chunk");
    const mockStream = createMockStream(chunks);
    const fullStop = jest.fn();

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
