import { GPTAsyncEncoder, LlamaAsyncEncoder } from "./asyncEncoder";

describe("llama encoder", () => {
  var tokenizer: LlamaAsyncEncoder;

  beforeAll(() => {
    tokenizer = new LlamaAsyncEncoder();
  });

  afterAll(() => {
    tokenizer.close().catch((e) => {});
  });

  test("hello world", async () => {
    const input = "the quick brown fox jumped over the lazy dog";
    const output = await tokenizer.encode(input);
    expect(output).toEqual([
      1, 278, 4996, 17354, 1701, 29916, 12500, 287, 975, 278, 17366, 11203,
    ]);
    const decoded = await tokenizer.decode(output);
    expect(decoded).toBe(input);
  });
});

describe("tiktoken encoder", () => {
  var tokenizer: GPTAsyncEncoder;

  beforeAll(() => {
    tokenizer = new GPTAsyncEncoder();
  });

  afterAll(() => {
    tokenizer.close().catch((e) => {});
  });

  test("hello world", async () => {
    const input = "the quick brown fox jumped over the lazy dog";
    const output = await tokenizer.encode(input);
    expect(output).toEqual([
      1820, 4062, 14198, 39935, 27096, 927, 279, 16053, 5679,
    ]);
    const decoded = await tokenizer.decode(output);
    expect(decoded).toBe(input);
  });
});
