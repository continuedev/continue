import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { editYamlText, structurallyEqual } from "./yamlEdit";

// Small deterministic PRNG so a failure is reproducible from the seed.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const WORDS = ["a", "b", "yes", "123", "x: y", "# no", "", "null", "é", "a b"];

function randomValue(r: () => number, depth: number): unknown {
  const t = Math.floor(r() * (depth > 2 ? 4 : 7));
  switch (t) {
    case 0:
      return WORDS[Math.floor(r() * WORDS.length)];
    case 1:
      return Math.floor(r() * 1000) - 500;
    case 2:
      return r() < 0.5;
    case 3:
      return null;
    case 4:
    case 5:
      return Array.from({ length: Math.floor(r() * 4) }, () =>
        randomValue(r, depth + 1),
      );
    default: {
      const o: Record<string, unknown> = {};
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        o[`k${Math.floor(r() * 6)}`] = randomValue(r, depth + 1);
      }
      if (r() < 0.4) o.name = WORDS[Math.floor(r() * WORDS.length)];
      return o;
    }
  }
}

function randomConfig(r: () => number): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const n = 1 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) o[`top${i}`] = randomValue(r, 0);
  return o;
}

const COMMENTED = `# header
top0: 1 # one
top1:
  # list comment
  - name: a
    k1: 2 # inline
  - name: b
top2:
  nested: x
`;

describe("editYamlText: randomized round trip", () => {
  it("what is written always parses back to exactly what the edit returned", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const before = randomConfig(r);
      const after = randomConfig(r);
      const source = YAML.stringify(before);

      const result = editYamlText<any>(source, () => after);
      if (result.text === undefined) {
        // Only allowed when nothing changed.
        expect(structurallyEqual(before, after), `seed ${seed}`).toBe(true);
        continue;
      }
      const reparsed = YAML.parse(result.text);
      expect(structurallyEqual(reparsed, after), `seed ${seed}`).toBe(true);
    }
  });

  it("is stable: applying the same edit to its own output changes nothing", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = rng(seed * 7919);
      const after = randomConfig(r);
      const first = editYamlText<any>(COMMENTED, () => after).text!;
      const second = editYamlText<any>(first, () => after);
      expect(second.text, `seed ${seed}`).toBeUndefined();
    }
  });

  it("random edits to a commented file keep its comments when untouched", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = rng(seed * 104729);
      const { text } = editYamlText<any>(COMMENTED, (c) => ({
        ...c,
        added: randomValue(r, 0),
      }));
      if (text === undefined) continue;
      expect(text, `seed ${seed}`).toContain("# header");
      expect(text, `seed ${seed}`).toContain("# one");
      expect(text, `seed ${seed}`).toContain("# list comment");
      expect(text, `seed ${seed}`).toContain("# inline");
    }
  });
});
