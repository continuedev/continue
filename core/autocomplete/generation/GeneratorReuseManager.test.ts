import { jest } from "@jest/globals";
import { GeneratorReuseManager } from "./GeneratorReuseManager";

// Mock implementation of ListenableGenerator
class MockListenableGenerator<T> {
  private generator: AsyncGenerator<T>;
  private listeners: Array<(chunk: T | undefined) => void> = [];
  private canceled = false;
  private chunks: T[] = [];
  private teeIndex = 0;

  constructor(
    generator: AsyncGenerator<T>,
    private onError: (err: any) => void,
  ) {
    this.generator = this._wrapGenerator(generator);
  }

  private async *_wrapGenerator(gen: AsyncGenerator<T>): AsyncGenerator<T> {
    try {
      for await (const chunk of gen) {
        if (this.canceled) break;
        this.chunks.push(chunk);
        this.listeners.forEach((listener) => listener(chunk));
        yield chunk;
      }
    } catch (err) {
      this.onError(err);
    } finally {
      this.listeners.forEach((listener) => listener(undefined));
    }
  }

  cancel() {
    this.canceled = true;
  }

  listen(callback: (chunk: T | undefined) => void) {
    this.listeners.push(callback);
    // Send already received chunks
    this.chunks.forEach((chunk) => callback(chunk));
  }

  async *tee(): AsyncGenerator<T> {
    while (this.teeIndex < this.chunks.length) {
      yield this.chunks[this.teeIndex++];
    }
    const iterator = this.generator[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      yield value;
      this.teeIndex++;
    }
  }
}

function createMockGenerator(
  data: string[],
  delay: number = 0,
): () => AsyncGenerator<string> {
  const mockGenerator = async function* () {
    for (const chunk of data) {
      yield chunk;

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };
  const newGenerator = jest
    .fn<() => AsyncGenerator<string>>()
    .mockReturnValue(mockGenerator());

  return newGenerator;
}

describe("GeneratorReuseManager", () => {
  let reuseManager: GeneratorReuseManager;
  let onErrorMock: jest.Mock;

  beforeEach(() => {
    onErrorMock = jest.fn();
    reuseManager = new GeneratorReuseManager(
      onErrorMock,
      // MockListenableGenerator as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("creates new generator when there is no current generator", async () => {
    const data = ["hello ", "world"];
    const newGenerator = createMockGenerator(data);

    const prefix = "";

    const generator = reuseManager.getGenerator(prefix, newGenerator, true);

    const output: string[] = [];
    for await (const chunk of generator) {
      output.push(chunk);
    }

    expect(output).toEqual(data);
    expect(newGenerator).toHaveBeenCalledTimes(1);
  });

  test("reuses generator when prefix matches pending completion", async () => {
    const newGenerator = createMockGenerator(["llo ", "world"]);

    // First call with initial prefix
    const prefix1 = "he";
    const generator1 = reuseManager.getGenerator(prefix1, newGenerator, true);

    const output1: string[] = [];
    for await (const chunk of generator1) {
      output1.push(chunk);
    }

    expect(output1).toEqual(["llo ", "world"]);

    // Second call with extended prefix that matches pending completion
    const prefix2 = "hello ";
    const generator2 = reuseManager.getGenerator(prefix2, newGenerator, true);

    const output2: string[] = [];
    for await (const chunk of generator2) {
      output2.push(chunk);
    }

    expect(output2).toEqual(["world"]);

    // Ensure generator was reused (newGenerator should be called only once)
    expect(newGenerator).toHaveBeenCalledTimes(1);
  });

  test("creates new generator when prefix does not match pending completion", async () => {
    const data = ["goodbye ", "world"];
    const newGenerator = createMockGenerator(data);

    // Initial generator with different prefix
    reuseManager.pendingGeneratorPrefix = "hello ";
    reuseManager.pendingCompletion = "world";

    const prefix = "good";
    const generator = reuseManager.getGenerator(prefix, newGenerator, true);

    const output: string[] = [];
    for await (const chunk of generator) {
      output.push(chunk);
    }

    expect(output).toEqual(data);
    // Ensure a new generator was created
    expect(newGenerator).toHaveBeenCalledTimes(1);
  });

  test("handles multiline=false by stopping at newline", async () => {
    const data = ["first line\n", "second line"];
    const newGenerator = createMockGenerator(data);

    const prefix = "";
    const generator = reuseManager.getGenerator(prefix, newGenerator, false);

    const output: string[] = [];
    for await (const chunk of generator) {
      output.push(chunk);
    }

    expect(output).toEqual(["first line"]);
    // Ensure it stops after the first newline
  });

  test("handles multiline=true by not stopping at newline", async () => {
    const data = ["first line\n", "second line"];
    const newGenerator = createMockGenerator(data);

    const prefix = "";
    const generator = reuseManager.getGenerator(prefix, newGenerator, true);

    const output: string[] = [];
    for await (const chunk of generator) {
      output.push(chunk);
    }

    expect(output).toEqual(data);
  });

  test("cancels previous generator when creating a new one", async () => {
    const data1 = ["data from generator 1", "not generated"];
    const data2 = ["data from generator 2"];

    const newGenerator1 = createMockGenerator(data1, 1000); // Delay so we have the chance to cancel it
    const newGenerator2 = createMockGenerator(data2);

    const prefix1 = "prefix1";
    const prefix2 = "prefix2";

    // First generator
    const generator1 = reuseManager.getGenerator(prefix1, newGenerator1, true);
    const output1: string[] = [];
    for await (const chunk of generator1) {
      output1.push(chunk);
      // Simulate the generator being canceled before completing
      reuseManager.currentGenerator?.cancel();
    }

    expect(output1.length).toEqual(1);
    expect(output1[0]).toEqual(data1[0]);

    // Second generator
    const generator2 = reuseManager.getGenerator(prefix2, newGenerator2, true);
    const output2: string[] = [];
    for await (const chunk of generator2) {
      output2.push(chunk);
    }

    expect(output2).toEqual(data2);
  });

  test("calls onError when generator throws an error", async () => {
    const error = new Error("Generator error");
    const mockGenerator = async function* () {
      throw error;
    };
    const newGenerator = jest
      .fn<() => AsyncGenerator<string>>()
      .mockReturnValue(mockGenerator());

    const prefix = "";
    const generator = reuseManager.getGenerator(prefix, newGenerator, true);

    const output: string[] = [];
    await expect(async () => {
      for await (const chunk of generator) {
        output.push(chunk);
      }
    }).not.toThrow(); // getGenerator handles errors internally

    expect(onErrorMock).toHaveBeenCalledWith(error);
    expect(output).toEqual([]);
  });

  test("handles backspacing by creating new generator when prefix is shorter", async () => {
    const data = ["hello world"];
    const newGenerator1 = createMockGenerator(data);
    const newGenerator2 = createMockGenerator(data);

    // First prefix
    const prefix1 = "hello world";
    const generator1 = reuseManager.getGenerator(prefix1, newGenerator1, true);
    const output1: string[] = [];
    for await (const chunk of generator1) {
      output1.push(chunk);
    }

    // Simulate backspace (prefix is shorter)
    const prefix2 = "hello worl";
    const generator2 = reuseManager.getGenerator(prefix2, newGenerator2, true);
    const output2: string[] = [];
    for await (const chunk of generator2) {
      output2.push(chunk);
    }

    // Ensure a new generator was created
    expect(newGenerator1).toHaveBeenCalledTimes(1);
    expect(newGenerator2).toHaveBeenCalledTimes(1);
  });
});
