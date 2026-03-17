import { describe, expect, it } from "vitest";
import {
  getRangeInString,
  intersection,
  union,
  maxPosition,
  minPosition,
} from "./ranges";
import type { Position, Range } from "../index.js";

describe("getRangeInString", () => {
  const content = "line0\nline1\nline2\nline3";

  it("returns substring for single-line range", () => {
    const range: Range = {
      start: { line: 0, character: 1 },
      end: { line: 0, character: 4 },
    };
    expect(getRangeInString(content, range)).toBe("ine");
  });

  it("returns full line when range spans entire line", () => {
    const range: Range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 5 },
    };
    expect(getRangeInString(content, range)).toBe("line1");
  });

  it("returns multi-line content", () => {
    const range: Range = {
      start: { line: 0, character: 3 },
      end: { line: 2, character: 3 },
    };
    expect(getRangeInString(content, range)).toBe("e0\nline1\nlin");
  });

  it("returns empty string for empty range on same line", () => {
    const range: Range = {
      start: { line: 0, character: 2 },
      end: { line: 0, character: 2 },
    };
    expect(getRangeInString(content, range)).toBe("");
  });

  it("handles range at end of content", () => {
    const range: Range = {
      start: { line: 3, character: 0 },
      end: { line: 3, character: 5 },
    };
    expect(getRangeInString(content, range)).toBe("line3");
  });

  it("returns empty string for out-of-bounds line", () => {
    const range: Range = {
      start: { line: 10, character: 0 },
      end: { line: 10, character: 5 },
    };
    expect(getRangeInString(content, range)).toBe("");
  });

  it("handles range spanning all lines", () => {
    const range: Range = {
      start: { line: 0, character: 0 },
      end: { line: 3, character: 5 },
    };
    expect(getRangeInString(content, range)).toBe(content);
  });
});

describe("intersection", () => {
  it("returns null for non-overlapping ranges (a before b)", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 1, character: 5 },
    };
    const b: Range = {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 5 },
    };
    expect(intersection(a, b)).toBeNull();
  });

  it("returns null for non-overlapping ranges (b before a)", () => {
    const a: Range = {
      start: { line: 5, character: 0 },
      end: { line: 6, character: 5 },
    };
    const b: Range = {
      start: { line: 0, character: 0 },
      end: { line: 2, character: 5 },
    };
    expect(intersection(a, b)).toBeNull();
  });

  it("returns null for same-line ranges with no character overlap", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    };
    const b: Range = {
      start: { line: 0, character: 10 },
      end: { line: 0, character: 15 },
    };
    expect(intersection(a, b)).toBeNull();
  });

  it("returns correct intersection for overlapping single-line ranges", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    };
    const b: Range = {
      start: { line: 0, character: 5 },
      end: { line: 0, character: 15 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 0, character: 5 },
      end: { line: 0, character: 10 },
    });
  });

  it("returns correct intersection for overlapping multi-line ranges", () => {
    const a: Range = {
      start: { line: 0, character: 5 },
      end: { line: 5, character: 10 },
    };
    const b: Range = {
      start: { line: 2, character: 3 },
      end: { line: 8, character: 7 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 2, character: 3 },
      end: { line: 5, character: 10 },
    });
  });

  it("returns correct intersection when one range contains the other", () => {
    const outer: Range = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 20 },
    };
    const inner: Range = {
      start: { line: 2, character: 5 },
      end: { line: 5, character: 10 },
    };
    expect(intersection(outer, inner)).toEqual(inner);
    expect(intersection(inner, outer)).toEqual(inner);
  });

  it("returns identical range for same ranges", () => {
    const range: Range = {
      start: { line: 1, character: 5 },
      end: { line: 3, character: 10 },
    };
    expect(intersection(range, range)).toEqual(range);
  });

  it("handles edge case of touching ranges on same line", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    };
    const b: Range = {
      start: { line: 0, character: 5 },
      end: { line: 0, character: 10 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 0, character: 5 },
      end: { line: 0, character: 5 },
    });
  });
});

describe("union", () => {
  it("returns combined range for non-overlapping ranges", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 1, character: 5 },
    };
    const b: Range = {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 5 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 4, character: 5 },
    });
  });

  it("returns combined range for overlapping ranges", () => {
    const a: Range = {
      start: { line: 0, character: 5 },
      end: { line: 3, character: 10 },
    };
    const b: Range = {
      start: { line: 2, character: 0 },
      end: { line: 5, character: 15 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 5 },
      end: { line: 5, character: 15 },
    });
  });

  it("returns outer range when one contains the other", () => {
    const outer: Range = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 20 },
    };
    const inner: Range = {
      start: { line: 2, character: 5 },
      end: { line: 5, character: 10 },
    };
    expect(union(outer, inner)).toEqual(outer);
    expect(union(inner, outer)).toEqual(outer);
  });

  it("returns same range for identical ranges", () => {
    const range: Range = {
      start: { line: 1, character: 5 },
      end: { line: 3, character: 10 },
    };
    expect(union(range, range)).toEqual(range);
  });

  it("handles ranges on same start line with different characters", () => {
    const a: Range = {
      start: { line: 0, character: 5 },
      end: { line: 2, character: 10 },
    };
    const b: Range = {
      start: { line: 0, character: 2 },
      end: { line: 3, character: 15 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 2 },
      end: { line: 3, character: 15 },
    });
  });

  it("handles ranges on same end line with different characters", () => {
    const a: Range = {
      start: { line: 0, character: 0 },
      end: { line: 5, character: 10 },
    };
    const b: Range = {
      start: { line: 2, character: 5 },
      end: { line: 5, character: 20 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 5, character: 20 },
    });
  });
});

describe("maxPosition", () => {
  it("returns position with greater line", () => {
    const a: Position = { line: 5, character: 0 };
    const b: Position = { line: 3, character: 10 };
    expect(maxPosition(a, b)).toEqual(a);
  });

  it("returns position with greater line (b > a)", () => {
    const a: Position = { line: 2, character: 15 };
    const b: Position = { line: 8, character: 0 };
    expect(maxPosition(a, b)).toEqual(b);
  });

  it("returns position with greater character when lines are equal", () => {
    const a: Position = { line: 5, character: 10 };
    const b: Position = { line: 5, character: 3 };
    expect(maxPosition(a, b)).toEqual(a);
  });

  it("returns position with greater character (b > a) when lines are equal", () => {
    const a: Position = { line: 5, character: 3 };
    const b: Position = { line: 5, character: 15 };
    expect(maxPosition(a, b)).toEqual(b);
  });

  it("returns first position when both are equal", () => {
    const a: Position = { line: 5, character: 10 };
    const b: Position = { line: 5, character: 10 };
    expect(maxPosition(a, b)).toEqual(a);
  });
});

describe("minPosition", () => {
  it("returns position with smaller line", () => {
    const a: Position = { line: 2, character: 15 };
    const b: Position = { line: 5, character: 0 };
    expect(minPosition(a, b)).toEqual(a);
  });

  it("returns position with smaller line (b < a)", () => {
    const a: Position = { line: 8, character: 0 };
    const b: Position = { line: 3, character: 10 };
    expect(minPosition(a, b)).toEqual(b);
  });

  it("returns position with smaller character when lines are equal", () => {
    const a: Position = { line: 5, character: 3 };
    const b: Position = { line: 5, character: 10 };
    expect(minPosition(a, b)).toEqual(a);
  });

  it("returns position with smaller character (b < a) when lines are equal", () => {
    const a: Position = { line: 5, character: 15 };
    const b: Position = { line: 5, character: 3 };
    expect(minPosition(a, b)).toEqual(b);
  });

  it("returns first position when both are equal", () => {
    const a: Position = { line: 5, character: 10 };
    const b: Position = { line: 5, character: 10 };
    expect(minPosition(a, b)).toEqual(a);
  });
});
