import { ChunkWithoutID } from "../..";
import { cleanupAsyncEncoders, countTokensAsync } from "../../llm/countTokens";
import { codeChunker } from "./code";

async function genToArr<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
}

async function genToStrs(
  generator: AsyncGenerator<ChunkWithoutID>,
): Promise<string[]> {
  return (await genToArr(generator)).map((chunk) => chunk.content);
}

describe.skip("codeChunker", () => {
  test("should return empty array if file empty", async () => {
    const chunks = await genToStrs(codeChunker("test.ts", "", 100));
    expect(chunks).toEqual([]);
  });

  test("should include entire file if smaller than max chunk size", async () => {
    const chunks = await genToStrs(codeChunker("test.ts", "abc", 100));
    expect(chunks).toEqual(["abc"]);
  });

  test("should capture small class and function from large python file", async () => {
    const extraLine = "# This is a comment";
    const myClass = "class MyClass:\n    def __init__(self):\n        pass";
    const myFunction = 'def my_function():\n    return "Hello, World!"';

    const file =
      Array(100).fill(extraLine).join("\n") +
      "\n\n" +
      myClass +
      "\n\n" +
      myFunction +
      "\n\n" +
      Array(100).fill(extraLine).join("\n");

    const chunks = await genToStrs(codeChunker("test.py", file, 200));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks).toContain(myClass);
    expect(chunks).toContain(myFunction);
  });

  test("should split large python class into methods and class with truncated methods", async () => {
    const methodI = (i: number) =>
      `    def method${i}():\n        return "Hello, ${i}!"`;

    const file =
      "class MyClass:\n" +
      Array(100)
        .fill(0)
        .map((_, i) => methodI(i + 1))
        .join("\n") +
      "\n\n";

    console.log(file);

    const chunks = await genToStrs(codeChunker("test.py", file, 200));
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks[0].startsWith("class MyClass:\n    def method1():\n        ..."),
    ).toBe(true);
    // The extra spaces seem to be a bug with tree-sitter-python
    expect(chunks).toContain('def method1():\n        return "Hello, 1!"');
    expect(chunks).toContain('def method20():\n        return "Hello, 20!"');
  });
});

async function collectContents(
  filepath: string,
  contents: string,
  maxChunkSize: number,
): Promise<string[]> {
  const out: string[] = [];
  for await (const c of codeChunker(filepath, contents, maxChunkSize)) {
    out.push(c.content);
  }
  return out;
}

describe("codeChunker function definition", () => {
  afterAll(async () => await cleanupAsyncEncoders());

  test("class methods never exceed maxChunkSize", async () => {
    const body = Array.from(
      { length: 200 },
      (_, i) => `console.log(${i});`,
    ).join("\n");
    const contents = `
class C {
  a() {
    ${body}
  }
  b() {
    ${body}
  }
}
`;
    const max = 50;
    const chunks = await collectContents("filename1.ts", contents, max);
    const counts = await Promise.all(chunks.map((s) => countTokensAsync(s)));
    counts.forEach((n) => expect(n).toBeLessThanOrEqual(max));
  });

  test("top-level functions never exceed maxChunkSize", async () => {
    const body = Array.from(
      { length: 150 },
      (_, i) => `const x${i} = ${i};`,
    ).join("\n");
    const contents = `
function f() {
  ${body}
}

function g() {
  ${body}
}
`;
    const max = 60;
    const chunks = await collectContents("filename2.ts", contents, max);
    const counts = await Promise.all(chunks.map((s) => countTokensAsync(s)));
    counts.forEach((n) => expect(n).toBeLessThanOrEqual(max));
  });
});
