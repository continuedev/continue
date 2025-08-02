import {
  vi,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from "vitest";
import { EventEmitter } from "events";
import { throttledGlob } from "../FileSearchUI.js";

// Define a custom interface for our mock
interface MockGlobEmitter extends EventEmitter {
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
}

// Create a variable to hold our mock event emitter
let mockEventEmitter: MockGlobEmitter;

// Setup the mock - we need to do this before importing the module that uses glob
vi.mock("glob", () => {
  return {
    stream: vi.fn(() => {
      const EventEmitter = require("events").EventEmitter;
      const emitter = new EventEmitter();
      emitter.pause = vi.fn().mockReturnValue(emitter);
      emitter.resume = vi.fn().mockReturnValue(emitter);
      return emitter;
    }),
  };
});

describe.skip("throttledGlob", () => {
  beforeEach(async () => {
    // Setup for each test
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Get the glob module and create a fresh mock event emitter
    const globModule = await import("glob");
    const streamFn = globModule.stream as any;
    mockEventEmitter = streamFn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return all matched files", async () => {
    const mockFiles = ["file1.ts", "file2.js", "file3.py"];
    const patterns = ["**/*.ts", "**/*.js", "**/*.py"];
    const options = { maxDepth: 3, dot: true };

    // Start the throttledGlob operation
    const promise = throttledGlob(patterns, options);

    // Emit file events
    mockFiles.forEach((file) => {
      mockEventEmitter.emit("data", file);
    });

    // Emit end event
    mockEventEmitter.emit("end");

    // Wait for the promise to resolve
    const result = await promise;

    // Verify the results
    expect(result).toEqual(mockFiles);
  });

  it("should pause and resume the stream for throttling", async () => {
    const patterns = ["**/*.ts"];
    const options = { maxDepth: 3 };
    const batchSize = 2; // Small batch size for testing
    const delay = 10; // Small delay for testing

    // Start the throttledGlob operation
    const promise = throttledGlob(patterns, options, batchSize, delay);

    // Emit enough files to trigger throttling
    for (let i = 0; i < batchSize + 1; i++) {
      mockEventEmitter.emit("data", `file${i}.ts`);
    }

    // Verify the stream was paused
    expect(mockEventEmitter.pause).toHaveBeenCalledTimes(1);

    // Fast-forward timers to trigger resume
    vi.advanceTimersByTime(delay);

    // Verify the stream was resumed
    expect(mockEventEmitter.resume).toHaveBeenCalledTimes(1);

    // Finish the stream
    mockEventEmitter.emit("end");

    // Wait for the promise to resolve
    const result = await promise;

    // Verify the expected number of files
    expect(result.length).toBe(batchSize + 1);
  });

  it("should handle error events", async () => {
    const patterns = ["**/*.ts"];
    const options = { maxDepth: 3 };
    const error = new Error("Test error");

    // Start the throttledGlob operation
    const promise = throttledGlob(patterns, options);

    // Emit an error event
    mockEventEmitter.emit("error", error);

    // The promise should reject with the error
    await expect(promise).rejects.toThrow("Test error");
  });

  it("should throttle with custom batch size and delay", async () => {
    const patterns = ["**/*.ts"];
    const options = { maxDepth: 3 };
    const customBatchSize = 5;
    const customDelay = 50;

    // Start the throttledGlob operation
    const promise = throttledGlob(
      patterns,
      options,
      customBatchSize,
      customDelay
    );

    // Emit enough files to trigger throttling twice
    for (let i = 0; i < customBatchSize * 2; i++) {
      mockEventEmitter.emit("data", `file${i}.ts`);
    }

    // Verify the stream was paused twice
    expect(mockEventEmitter.pause).toHaveBeenCalledTimes(2);

    // Fast-forward timers for first resume
    vi.advanceTimersByTime(customDelay);
    expect(mockEventEmitter.resume).toHaveBeenCalledTimes(1);

    // Fast-forward timers for second resume
    vi.advanceTimersByTime(customDelay);
    expect(mockEventEmitter.resume).toHaveBeenCalledTimes(2);

    // Finish the stream
    mockEventEmitter.emit("end");

    // Wait for the promise to resolve
    const result = await promise;

    // Verify the expected number of files
    expect(result.length).toBe(customBatchSize * 2);
  });
});
