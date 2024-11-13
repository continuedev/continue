import { dedent } from "./index";

describe("dedent function", () => {
  it("should remove common leading whitespace from all lines", () => {
    const result = dedent`
      Hello
        World
          !
    `;
    expect(result).toBe("Hello\n  World\n    !");
  });

  it("should handle strings with no indentation", () => {
    const result = dedent`Hello
World
!`;
    expect(result).toBe("Hello\nWorld\n!");
  });

  it("should handle strings with mixed indentation", () => {
    const result = dedent`
      Hello
    World
        !
    `;
    expect(result).toBe("  Hello\nWorld\n    !");
  });

  it("should remove leading and trailing empty lines", () => {
    const result = dedent`

      Hello
      World

    `;
    expect(result).toBe("Hello\nWorld");
  });

  it("should handle empty strings", () => {
    const result = dedent``;
    expect(result).toBe("");
  });

  it("should handle strings with only whitespace", () => {
    const result = dedent`
    
    `;
    expect(result).toBe("");
  });

  it.skip("should handle strings with tabs", () => {
    const result = dedent`
      \tHello
      \t\tWorld
      \t\t\t!
`;
    expect(result).toBe("\tHello\n\t\tWorld\n\t\t\t!");
  });

  it("should handle interpolated values", () => {
    const world = "World";
    const result = dedent`
      Hello ${world}
        How are you?
    `;
    expect(result).toBe("Hello World\n  How are you?");
  });

  it("should handle multiple interpolated values", () => {
    const greeting = "Hello";
    const name = "Alice";
    const question = "How are you?";
    const result = dedent`
      ${greeting} ${name}
        ${question}
    `;
    expect(result).toBe("Hello Alice\n  How are you?");
  });

  it("should handle interpolated values with different indentation", () => {
    const value1 = "foo";
    const value2 = "bar";
    const result = dedent`
      ${value1}
        ${value2}
    `;
    expect(result).toBe("foo\n  bar");
  });

  it("should handle a single line with indentation", () => {
    const result = dedent`    Hello World!`;
    expect(result).toBe("Hello World!");
  });

  it("should handle a string with only one non-empty line", () => {
    const result = dedent`
      
      Hello World!
      
    `;
    expect(result).toBe("Hello World!");
  });

  it("should handle a string with Unicode characters", () => {
    const result = dedent`
      こんにちは
        世界
    `;
    expect(result).toBe("こんにちは\n  世界");
  });

  it("should handle a string with emoji", () => {
    const result = dedent`
      🌍
        🌎
          🌏
    `;
    expect(result).toBe("🌍\n  🌎\n    🌏");
  });

  it.skip("should handle a string with CRLF line endings", () => {
    const result = dedent`
      Hello\r
        World\r
    `;
    expect(result).toBe("Hello\r\n  World");
  });

  it("should not count empty lines in the minimum indentation", () => {
    const result = dedent`
      Hello

      World
    `;

    expect(result).toBe("Hello\n\nWorld");
  });

  it("should work with templated strings", () => {
    const language = "typescript";
    const code = "console.log('hello');\nconsole.log('world');";

    const result = dedent`
        This is the prefix of the file:
        \`\`\`${language}
        ${code}
        \`\`\``;

    expect(result).toBe(`\
This is the prefix of the file:
\`\`\`${language}
${code}
\`\`\``);
  });
});
