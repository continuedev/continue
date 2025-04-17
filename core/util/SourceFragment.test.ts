import { SourceFragment, SourceFragmentRange } from './SourceFragment';

describe('Core retrieval methods', () => {
  it('accurately counts lines, including blank ones when whitespace is significant', () => {
    const fragment = new SourceFragment("foo\n\nbar");
    expect(fragment.getLineCount()).toBe(3);
    expect(fragment.getLineCount({ ignoreWhitespace: true })).toBe(2);
  });

  it('returns the full text unchanged when no range is given, and trims correctly when ignoring whitespace', () => {
    const text = " line1 \nline2 \n  line3  ";
    const fragment = new SourceFragment(text);
    expect(fragment.getAsText()).toBe(text);
    expect(fragment.getAsText({ ignoreWhitespace: true })).toBe("line1\nline2\nline3");
  });

  it('extracts lines using start/end offsets', () => {
    const text = "abcdef\nghijkl\nmnopqr";
    const fragment = new SourceFragment(text);
    const range: SourceFragmentRange = { startLine: 0, startLineOffset: 2, endLine: 1, endLineLimit: 4 };
    expect(fragment.getAsLines({ range, ignoreWhitespace: false })).toEqual(["cdef", "ghij"]);
    expect(fragment.getAsText({ range, ignoreWhitespace: true })).toBe("cdef\nghij");
  });

  it('getLineCount works with passed range', () => {
    const text = "a\nb\nc\nd";
    const fragment = new SourceFragment(text);
    expect(fragment.getLineCount({ range: { startLine: 1, endLine: 2 } })).toBe(2);
    expect(fragment.getLineCount({ range: { startLine: 10, endLine: 20 } })).toBe(0);
  });

  it('getAsLines returns empty array when range out of bounds', () => {
    const text = "x\ny";
    const fragment = new SourceFragment(text);
    expect(fragment.getAsLines({ range: { startLine: 5, endLine: 6 }, ignoreWhitespace: false })).toEqual([]);
  });

  it('getAsLines handles offsets beyond line length gracefully', () => {
    const text = "hello\nworld";
    const fragment = new SourceFragment(text);
    const range: SourceFragmentRange = { startLine: 0, startLineOffset: 100, endLine: 0, endLineLimit: 50 };
    expect(fragment.getAsLines({ range, ignoreWhitespace: false })).toEqual([""]);
  });

  it('getAsFragment produces functional fragment', () => {
    const text = "line1\nline2";
    const fragment = new SourceFragment(text);
    const subFragment = fragment.getAsFragment({ range: { startLine: 1, endLine: 1 } });
    expect(subFragment.getAsText()).toBe("line2");
  });
});

describe('head and tail operations', () => {
  const text = "\n foo\n\n bar\n";
  const fragment = new SourceFragment(text);

  it('preserves every raw line, including blank lines and whitespace, by default', () => {
    expect(fragment.head(4)).toEqual(["", " foo", "", " bar"]);
    expect(fragment.tail(3)).toEqual(["", " bar", ""]);
  });

  it('only trims and omits blank lines when ignoreWhitespace:true is set', () => {
    expect(fragment.head(2, { ignoreWhitespace: true })).toEqual(["foo", "bar"]);
    expect(fragment.tail(2, { ignoreWhitespace: true })).toEqual(["foo", "bar"]);
  });

  it('returns zero lines for head and tail when maxLines is zero', () => {
    const text = "one\ntwo\nthree";
    const fragment = new SourceFragment(text);
    expect(fragment.head(0)).toEqual([]);
    expect(fragment.tail(0)).toEqual([]);
  });
});

describe('Line enumeration', () => {
  const text = "a\n\n b\nc";
  const fragment = new SourceFragment(text);

  it('yields lines forward by default', () => {
    const lines = Array.from(fragment.iterateLines());
    expect(lines).toEqual(["a", "", " b", "c"]);
  });

  it('yields lines backward when backward:true', () => {
    const lines = Array.from(fragment.iterateLines({ backward: true }));
    expect(lines).toEqual(["c", " b", "", "a"]);
  });

  it('respects maxLines parameter', () => {
    const forwardTwo = Array.from(fragment.iterateLines({ maxLines: 2 }));
    expect(forwardTwo).toEqual(["a", ""]);
    const backwardTwo = Array.from(fragment.iterateLines({ backward: true, maxLines: 2 }));
    expect(backwardTwo).toEqual(["c", " b"]);
  });
});

describe('Completion behavior', () => {
  const fullText = "hello\nworld";
  const fullfragment = new SourceFragment(fullText);

  it('returns the correct remainder when the prefix matches across lines', () => {
    const partial = new SourceFragment("hello\nwo");
    const leftoverCompletion = partial.getRemainingCompletion(fullfragment);
    expect(leftoverCompletion).not.toBeNull();
    expect(leftoverCompletion!.getAsText()).toBe("rld");
  });

  it('returns null when the prefix does not align with the full text', () => {
    const partial = new SourceFragment("hi\nworld");
    expect(partial.getRemainingCompletion(fullfragment)).toBeNull();
  });

  it('returns the entire full fragment when given an empty fragment', () => {
    const empty = new SourceFragment("");
    const leftoverCompletion = empty.getRemainingCompletion(fullfragment);
    expect(leftoverCompletion!.getAsText()).toBe(fullText);
  });

  it('skips a trailing blank line when the prefix ends with a newline', () => {
    const partial = new SourceFragment("hello\n");
    const leftoverCompletion = partial.getRemainingCompletion(fullfragment);
    expect(leftoverCompletion!.getAsText()).toBe("world");
  });

  it('matches trimmed prefix but returns the untrimmed remainder when ignoring whitespace', () => {
    const full = new SourceFragment("  hello  \n  world  ");
    const partial = new SourceFragment("hello");
    const leftoverCompletion = partial.getRemainingCompletion(full, { ignoreWhitespace: true });
    expect(leftoverCompletion!.getAsText({ ignoreWhitespace: false })).toBe("  \n  world  ");
  });

  it('supports partial-line matches even without a trailing newline', () => {
    const full = new SourceFragment("function foo() { return 42; }");
    const partial = new SourceFragment("function foo() { ret");
    const leftoverCompletion = partial.getRemainingCompletion(full);
    expect(leftoverCompletion!.getAsText()).toBe("urn 42; }");
  });

  it('getRemainingCompletion with ignoreWhitespace:false respects exact whitespace', () => {
    const full = new SourceFragment("foo bar");
    const partial = new SourceFragment("foo");
    const remainingCompletion = partial.getRemainingCompletion(full, { ignoreWhitespace: false });
    expect(remainingCompletion).not.toBeNull();
    expect(remainingCompletion!.getAsText()).toBe(" bar");
  });

  it('getRemainingCompletion returns null when prefix longer than full', () => {
    const full = new SourceFragment("abc");
    const partial = new SourceFragment("abcd");
    expect(partial.getRemainingCompletion(full)).toBeNull();
  });

  it('handles embedded blank lines when user typed through the blank line', () => {
    const full = new SourceFragment("foo\n\nbar\nbaz");
    const partial = new SourceFragment("foo\n\n");
    const leftover = partial.getRemainingCompletion(full);
    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("bar\nbaz");
  });

  it('let user type through spaces', () => {
    const full = new SourceFragment("hello world");
    const partial = new SourceFragment("hello ");
    const leftoverCompletion = partial.getRemainingCompletion(full);
    expect(leftoverCompletion!.getAsText()).toBe("world");
  });

  it('handles partial typing at the beginning of a new line', () => {
    const full = new SourceFragment("first line\n\nsecond line");

    const partial1 = new SourceFragment("first line\nsecon");
    const leftover1 = partial1.getRemainingCompletion(full, { ignoreWhitespace: true });
    expect(leftover1).not.toBeNull();
    expect(leftover1!.getAsText()).toBe("d line");
  });

  it('handles whitespace differences at the beginning of lines', () => {
    const full = new SourceFragment("function test() {\n  const x = 1;\n  return x;\n}");

    const partial = new SourceFragment("function test() {\nconst");
    const leftover = partial.getRemainingCompletion(full, { ignoreWhitespace: true });
    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText({ ignoreWhitespace: true })).toBe("x = 1;\nreturn x;\n}");
  });

  it('correctly identifies completion between partial prefix and suffix lines', () => {
    const full = new SourceFragment(
      "  subtract(number) {\n    this.result -= number;\n    return this;\n  }",
    );
    const prefix = new SourceFragment(
      "  subtract(number) {\n    this.result -= number;\n    ",
    );
    const suffix = new SourceFragment("this;\n  }");

    const leftover = prefix.getRemainingCompletion(full);
    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("return this;\n  }");

    const truncated = leftover!.getAsTruncatedFragment({ suffix });
    expect(truncated.getAsText()).toBe("return ");
  });

  it('handles whitespace-only last line with mergeWhitespace option', () => {
    const full = new SourceFragment("function test() {\n  return 42;\n}");

    const partialWithWhitespace = new SourceFragment("function test() {\n  ");

    const leftover = partialWithWhitespace.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: true
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("return 42;\n}");

    const partialWithNewline = new SourceFragment("function test() {\n  \n");
    const leftoverWithNewline = partialWithNewline.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: true
    });

    expect(leftoverWithNewline).not.toBeNull();
    expect(leftoverWithNewline!.getAsText()).toBe("return 42;\n}");
  });

  it('handles leading whitespace differences correctly', () => {
    const full = new SourceFragment("function test() {\n    this.result -= number;\n}");
    const partial = new SourceFragment("function test() {\n  ");

    const leftover = partial.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: true
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("  this.result -= number;\n}");

    const partial2 = new SourceFragment("function test() {\n   ");
    const leftover2 = partial2.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: false,
    });

    expect(leftover2).not.toBeNull();
    expect(leftover2!.getAsText()).toBe(" this.result -= number;\n}");
  });

  it('preserves indentation when merging whitespace-only lines', () => {
    const full = new SourceFragment("\n    this.result -= number;\n");
    const partial = new SourceFragment("\n  ");

    const leftover = partial.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: false,
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("  this.result -= number;\n");
  });

  it('preserves indentation when merging whitespace-only lines with newlines', () => {
    const full = new SourceFragment("\n    this.result -= number;\n");
    const partial = new SourceFragment("\n  ");

    const leftover = partial.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: true,
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("  this.result -= number;\n");
  });

  it('avoids overwriting completion text with merged whitespace', () => {
    const full = new SourceFragment("\n    if (number === 0) {\n");
    const partial = new SourceFragment("\n           ");

    const leftover = partial.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: true,
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("if (number === 0) {\n");
  });

  it('correctly handles whitespace with indent-only lines in merge range determination', () => {
    const full = new SourceFragment("function test() {\n  if (condition) {\n    doSomething();\n  }\n}");

    // Create a partial fragment that ends with an indent-only line
    // This is the case that was affected by the bug
    const partial = new SourceFragment("function test() {\n  ");

    const leftover = partial.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: false
    });

    expect(leftover).not.toBeNull();
    expect(leftover!.getAsText()).toBe("if (condition) {\n    doSomething();\n  }\n}");

    const partialWithCode = new SourceFragment("function test() {\n  // comment\n  ");
    const leftoverAfterCode = partialWithCode.getRemainingCompletion(full, {
      mergeWhitespace: true,
      ignoreWhitespace: false
    });

    expect(leftoverAfterCode).toBeNull();
  });

  it('returns the entire reference fragment when source has zero lines and ignoreWhitespace is false', () => {
    console.log(`test`)
    const empty = new SourceFragment("\n");
    const leftoverCompletion = empty.getRemainingCompletion(fullfragment, { ignoreWhitespace: false });
    expect(leftoverCompletion).not.toBeNull();
    expect(leftoverCompletion!.getAsText()).toBe(fullText);

    const leftoverCompletion2 = empty.getRemainingCompletion(fullfragment, { ignoreWhitespace: true });
    expect(leftoverCompletion2).not.toBeNull();
    expect(leftoverCompletion2!.getAsText()).toBe(fullText);
  });
});

describe('Suffix comparison methods', () => {
  it('detects when one fragment ends with the start of another', () => {
    const base = new SourceFragment("function foo() {\n  return 42;");
    const full = new SourceFragment("function foo() {\n  return 42;\n}");
    expect(base.endsWithStartOf(full)).toBe(true);
    expect(base.endsWithStartOf(full, { ignoreWhitespace: false })).toBe(true);
  });

  it('determines exact vs. trimmed suffix matches correctly', () => {
    const main = new SourceFragment("line1\nline2\n  line3  ");
    const ending = new SourceFragment("line2\nline3");
    expect(main.endsWith(ending)).toBe(true);
    expect(main.endsWith(ending, { ignoreWhitespace: false })).toBe(false);
  });

  it('endsWith returns false when fragment shorter than suffix', () => {
    const fragment = new SourceFragment("short");
    const suffix = new SourceFragment("longer suffix");
    expect(fragment.endsWith(suffix)).toBe(false);
  });

  it('endsWithStartOf returns false when prefix longer than full fragment', () => {
    const fragment = new SourceFragment("longer prefix");
    const full = new SourceFragment("short");
    expect(fragment.endsWithStartOf(full)).toBe(false);
  });
});

describe('Spurious completion culling', () => {
  it('truncates by range correctly', () => {
    const fragment = new SourceFragment("hello\nworld\ntest");
    const truncated = fragment.getAsTruncatedFragment({
      range: { startLine: 0, endLine: 1, endLineLimit: 2 }
    });
    expect(truncated.getAsText()).toBe("hello\nwo");
  });

  it('truncates at exact character boundary', () => {
    const fragment = new SourceFragment("abcdef");
    const truncated = fragment.getAsTruncatedFragment({
      range: { startLine: 0, endLine: 0, endLineLimit: 3 }
    });
    expect(truncated.getAsText()).toBe("abc");
  });

  it('returns original fragment when range exceeds fragment bounds', () => {
    const text = "short text";
    const fragment = new SourceFragment(text);
    const truncated = fragment.getAsTruncatedFragment({
      range: { startLine: 0, endLine: 10 }
    });
    expect(truncated.getAsText()).toBe(text);
  });

  it('removes overlap with suffix fragment', () => {
    const base = new SourceFragment("function test() {\n  const x = 1;");
    const suffix = new SourceFragment("const x = 1;\n  return x;\n}");
    const truncated = base.getAsTruncatedFragment({ suffix });
    expect(truncated.getAsText()).toBe("function test() {\n  ");
  });

  it('returns original text when no overlap exists', () => {
    const base = new SourceFragment("function test() {");
    const suffix = new SourceFragment("return 42;\n}");
    const truncated = base.getAsTruncatedFragment({ suffix });
    expect(truncated.getAsText()).toBe("function test() {");
  });

  it('handles both range and suffix truncation together', () => {
    const base = new SourceFragment("function test() {\n  const x = 1;");
    const suffix = new SourceFragment("const x = 1;\n  return x;\n}");
    const truncated = base.getAsTruncatedFragment({
      suffix,
      range: { startLine: 0, endLine: 0, endLineLimit: 10 }
    });
    expect(truncated.getAsText()).toBe("function t");
  });

  it('respects ignoreWhitespace option when removing overlap', () => {
    const base = new SourceFragment("function test() {\n  const x = 1;");
    const suffix = new SourceFragment("    const x = 1;\n  return x;\n}");

    const truncated1 = base.getAsTruncatedFragment({
      suffix,
      ignoreWhitespace: true
     });
    expect(truncated1.getAsText()).toBe("function test() {\n  ");

    const truncated2 = base.getAsTruncatedFragment({
      suffix,
      ignoreWhitespace: false
    });
    expect(truncated2.getAsText()).toBe("function test() {\n  const x = 1;");
  });

  it('returns a copy of the original fragment when no options provided', () => {
    const text = "original text";
    const fragment = new SourceFragment(text);
    const result = fragment.getAsTruncatedFragment({});
    expect(result.getAsText()).toBe(text);
    expect(result).not.toBe(fragment);
  });

  it('respects matchFromStart option when removing overlap', () => {
    const base = new SourceFragment(
      "function test() {\n  const x = getResult();",
    );
    const suffix = new SourceFragment("Result();\n  return x;\n}");

    const truncated1 = base.getAsTruncatedFragment({
      suffix,
      matchFromStart: true,
    });
    expect(truncated1.getAsText()).toBe(
      "function test() {\n  const x = getResult();",
    );

    const truncated2 = base.getAsTruncatedFragment({
      suffix,
      matchFromStart: false,
    });
    expect(truncated2.getAsText()).toBe("function test() {\n  const x = get");
  });
});
