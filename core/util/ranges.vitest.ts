import { describe, expect, it } from "vitest";
import {
  getRangeInString,
  intersection,
  union,
  maxPosition,
  minPosition,
} from "./ranges";

describe("getRangeInString", () => {
  const multiLineContent = "line 0\nline 1\nline 2\nline 3\nline 4";

  it("should extract a single line range", () => {
    const range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe("line 1");
  });

  it("should extract a partial single line range", () => {
    const range = {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 5 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe("ne ");
  });

  it("should extract a multi-line range", () => {
    const range = {
      start: { line: 1, character: 0 },
      end: { line: 2, character: 6 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe("line 1\nline 2");
  });

  it("should extract a multi-line range with partial first and last lines", () => {
    const range = {
      start: { line: 1, character: 2 },
      end: { line: 3, character: 4 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe(
      "ne 1\nline 2\nline",
    );
  });

  it("should handle range spanning entire content", () => {
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 4, character: 6 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe(multiLineContent);
  });

  it("should return empty string for out of bounds line", () => {
    const range = {
      start: { line: 10, character: 0 },
      end: { line: 10, character: 5 },
    };
    expect(getRangeInString(multiLineContent, range)).toBe("");
  });

  it("should handle empty content", () => {
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
    expect(getRangeInString("", range)).toBe("");
  });

  it("should handle single line content", () => {
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    };
    expect(getRangeInString("hello world", range)).toBe("hello");
  });
});

describe("intersection", () => {
  it("should return null for non-overlapping ranges on different lines", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 1, character: 5 },
    };
    const b = {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 5 },
    };
    expect(intersection(a, b)).toBeNull();
  });

  it("should return null for non-overlapping ranges on same line", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    };
    const b = {
      start: { line: 0, character: 10 },
      end: { line: 0, character: 15 },
    };
    expect(intersection(a, b)).toBeNull();
  });

  it("should return intersection for overlapping ranges on same line", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    };
    const b = {
      start: { line: 0, character: 5 },
      end: { line: 0, character: 15 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 0, character: 5 },
      end: { line: 0, character: 10 },
    });
  });

  it("should return intersection for overlapping multi-line ranges", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 5, character: 10 },
    };
    const b = {
      start: { line: 3, character: 5 },
      end: { line: 8, character: 5 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 3, character: 5 },
      end: { line: 5, character: 10 },
    });
  });

  it("should return the smaller range when one contains the other", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 10 },
    };
    const b = {
      start: { line: 3, character: 5 },
      end: { line: 5, character: 5 },
    };
    expect(intersection(a, b)).toEqual({
      start: { line: 3, character: 5 },
      end: { line: 5, character: 5 },
    });
  });

  it("should handle identical ranges", () => {
    const a = {
      start: { line: 1, character: 5 },
      end: { line: 3, character: 10 },
    };
    expect(intersection(a, a)).toEqual(a);
  });

  it("should handle touching ranges (same line, adjacent characters)", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    };
    const b = {
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
  it("should return union of non-overlapping ranges", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 1, character: 5 },
    };
    const b = {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 5 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 4, character: 5 },
    });
  });

  it("should return union of overlapping ranges", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 3, character: 10 },
    };
    const b = {
      start: { line: 2, character: 5 },
      end: { line: 5, character: 5 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 5, character: 5 },
    });
  });

  it("should handle ranges on the same start line", () => {
    const a = {
      start: { line: 0, character: 5 },
      end: { line: 2, character: 10 },
    };
    const b = {
      start: { line: 0, character: 10 },
      end: { line: 3, character: 5 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 5 },
      end: { line: 3, character: 5 },
    });
  });

  it("should handle ranges on the same end line", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 3, character: 5 },
    };
    const b = {
      start: { line: 1, character: 0 },
      end: { line: 3, character: 15 },
    };
    expect(union(a, b)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 3, character: 15 },
    });
  });

  it("should handle identical ranges", () => {
    const a = {
      start: { line: 1, character: 5 },
      end: { line: 3, character: 10 },
    };
    expect(union(a, a)).toEqual(a);
  });

  it("should return containing range when one contains the other", () => {
    const a = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 10 },
    };
    const b = {
      start: { line: 3, character: 5 },
      end: { line: 5, character: 5 },
    };
    expect(union(a, b)).toEqual(a);
  });
});

describe("maxPosition", () => {
  it("should return position with greater line", () => {
    const a = { line: 5, character: 0 };
    const b = { line: 3, character: 10 };
    expect(maxPosition(a, b)).toBe(a);
    expect(maxPosition(b, a)).toBe(a);
  });

  it("should return position with greater character when lines are equal", () => {
    const a = { line: 3, character: 10 };
    const b = { line: 3, character: 5 };
    expect(maxPosition(a, b)).toBe(a);
    expect(maxPosition(b, a)).toBe(a);
  });

  it("should return first position when positions are identical", () => {
    const pos = { line: 3, character: 5 };
    expect(maxPosition(pos, pos)).toBe(pos);
  });

  it("should handle position at origin", () => {
    const a = { line: 0, character: 0 };
    const b = { line: 1, character: 0 };
    expect(maxPosition(a, b)).toBe(b);
  });
});

describe("minPosition", () => {
  it("should return position with smaller line", () => {
    const a = { line: 5, character: 0 };
    const b = { line: 3, character: 10 };
    expect(minPosition(a, b)).toBe(b);
    expect(minPosition(b, a)).toBe(b);
  });

  it("should return position with smaller character when lines are equal", () => {
    const a = { line: 3, character: 10 };
    const b = { line: 3, character: 5 };
    expect(minPosition(a, b)).toBe(b);
    expect(minPosition(b, a)).toBe(b);
  });

  it("should return first position when positions are identical", () => {
    const pos = { line: 3, character: 5 };
    expect(minPosition(pos, pos)).toBe(pos);
  });

  it("should handle position at origin", () => {
    const a = { line: 0, character: 0 };
    const b = { line: 1, character: 0 };
    expect(minPosition(a, b)).toBe(a);
  });
});
