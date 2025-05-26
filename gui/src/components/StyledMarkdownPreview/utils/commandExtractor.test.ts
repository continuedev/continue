import { extractCommand } from "./commandExtractor";

describe("extractCommand", () => {
  // Test basic command extraction
  it("should extract command from $ prompt", () => {
    expect(extractCommand("$ echo hello")).toBe("echo hello");
    expect(extractCommand("$  echo hello")).toBe("echo hello");
    expect(extractCommand("$echo hello")).toBe("echo hello");
  });

  // Test comment removal
  it("should remove comments at beginning of lines", () => {
    expect(extractCommand("# shell comment\necho hello")).toBe("echo hello");
    expect(extractCommand("// js comment\necho hello")).toBe("echo hello");
    expect(extractCommand("/* multi-line\ncomment */\necho hello")).toBe(
      "echo hello",
    );
  });

  // Test multiline comment removal
  it("should remove multiline comments anywhere in the text", () => {
    expect(extractCommand("echo /* comment */ hello")).toBe("echo hello");
    expect(extractCommand("echo hello /* comment */")).toBe("echo hello");
    expect(extractCommand("echo /* multiple\nline\ncomment */ hello")).toBe(
      "echo hello",
    );
  });

  // Test line continuation handling
  it("should handle line continuations correctly", () => {
    expect(extractCommand("echo hello && \\\necho world")).toBe(
      "echo hello && echo world",
    );
    expect(extractCommand("echo hello | \\\ngrep h")).toBe(
      "echo hello | grep h",
    );
    expect(extractCommand("echo hello \\\nworld")).toBe("echo hello world");
  });

  // Test complex command combinations
  it("should handle complex command combinations", () => {
    expect(
      extractCommand(`
      # shell comment
      echo hello /* inline comment */ && \\
      // js comment
      echo world
    `),
    ).toBe("echo hello && echo world");
  });

  // Test empty and whitespace handling
  it("should handle empty and whitespace inputs", () => {
    expect(extractCommand("")).toBe("");
    expect(extractCommand("   \n   \t   ")).toBe("");
  });

  // Test comment-only inputs
  it("should handle comment-only inputs", () => {
    expect(extractCommand("/* comment */")).toBe("");
    expect(extractCommand("# comment")).toBe("");
    expect(extractCommand("// comment")).toBe("");
    expect(extractCommand("/* multi\nline\ncomment */")).toBe("");
  });

  // Test inline comments
  it("should handle inline comments correctly according to implementation", () => {
    // But removes multiline comments even when inline
    expect(extractCommand("/* inline */ echo hello world")).toBe(
      "echo hello world",
    );
  });

  // Test multiple line continuations
  it("should handle multiple line continuations", () => {
    expect(
      extractCommand(`
      echo hello && \\
      echo world && \\
      echo test
    `),
    ).toBe("echo hello && echo world && echo test");
  });

  // Test nested line continuations
  it("should handle nested line continuations", () => {
    expect(
      extractCommand(`
      echo hello && \\
      (echo nested && \\
       echo more) && \\
      echo final
    `),
    ).toBe("echo hello && (echo nested && echo more) && echo final");
  });
});
