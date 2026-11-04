import path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import TransformersJsEmbeddingsProvider from "./TransformersJsEmbeddingsProvider";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

describe("TransformersJsEmbeddingsProvider", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // embed() returns a mock vector under NODE_ENV=test; run the real model here
    process.env.NODE_ENV = "development";
    TransformersJsEmbeddingsProvider.setLocalModelPath(
      path.resolve(process.cwd(), "../extensions/vscode/models"),
    );
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    TransformersJsEmbeddingsProvider.setLocalModelPath(undefined);
  });

  it("returns an empty array for no chunks", async () => {
    const provider = new TransformersJsEmbeddingsProvider();
    expect(await provider.embed([])).toEqual([]);
  }, 60000);

  it("embeds text into normalized 384-dimensional vectors", async () => {
    const provider = new TransformersJsEmbeddingsProvider();
    const [vec] = await provider.embed([
      "The quick brown fox jumps over the lazy dog.",
    ]);

    expect(vec).toHaveLength(384);
    expect(vec.every((x: number) => Number.isFinite(x))).toBe(true);
    const norm = Math.sqrt(vec.reduce((s: number, x: number) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 3);
  }, 60000);

  it("ranks semantically similar sentences above unrelated ones", async () => {
    const provider = new TransformersJsEmbeddingsProvider();
    const [cat, kitten, finance] = await provider.embed([
      "A cat is sleeping on the sofa.",
      "A kitten naps on the couch.",
      "Quarterly interest rates were raised by the central bank.",
    ]);

    expect(cat).toHaveLength(384);
    expect(cosine(cat, cat)).toBeCloseTo(1, 3);
    expect(cosine(cat, kitten)).toBeGreaterThan(0.6);
    expect(cosine(cat, kitten)).toBeGreaterThan(cosine(cat, finance) + 0.3);
  }, 60000);
});
