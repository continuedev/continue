import { describe, expect, it } from "vitest";
import {
  capitalizeFirstLetter,
  escapeForSVG,
  kebabOfStr,
  kebabOfThemeStr,
  replaceEscapedCharacters,
} from "./text";

describe("capitalizeFirstLetter", () => {
  it("should capitalize the first letter of a string", () => {
    expect(capitalizeFirstLetter("hello")).toBe("Hello");
    expect(capitalizeFirstLetter("world")).toBe("World");
  });

  it("should handle already capitalized strings", () => {
    expect(capitalizeFirstLetter("Hello")).toBe("Hello");
  });

  it("should handle single character strings", () => {
    expect(capitalizeFirstLetter("a")).toBe("A");
    expect(capitalizeFirstLetter("A")).toBe("A");
  });

  it("should handle empty strings", () => {
    expect(capitalizeFirstLetter("")).toBe("");
  });

  it("should handle strings with numbers", () => {
    expect(capitalizeFirstLetter("123abc")).toBe("123abc");
  });

  it("should handle strings with special characters", () => {
    expect(capitalizeFirstLetter("@hello")).toBe("@hello");
    expect(capitalizeFirstLetter("!world")).toBe("!world");
  });
});

describe("replaceEscapedCharacters", () => {
  it("should replace escaped newlines with actual newlines", () => {
    expect(replaceEscapedCharacters("Hello\\nWorld")).toBe("Hello\nWorld");
  });

  it("should replace escaped tabs with actual tabs", () => {
    expect(replaceEscapedCharacters("Hello\\tWorld")).toBe("Hello\tWorld");
  });

  it("should replace escaped carriage returns with actual carriage returns", () => {
    expect(replaceEscapedCharacters("Hello\\rWorld")).toBe("Hello\rWorld");
  });

  it("should replace escaped backslashes with actual backslashes", () => {
    expect(replaceEscapedCharacters("Hello\\\\World")).toBe("Hello\\World");
  });

  it("should replace escaped double quotes with actual double quotes", () => {
    expect(replaceEscapedCharacters('Hello\\"World')).toBe('Hello"World');
  });

  it("should replace escaped single quotes with actual single quotes", () => {
    expect(replaceEscapedCharacters("Hello\\'World")).toBe("Hello'World");
  });

  it("should handle multiple escaped characters", () => {
    expect(
      replaceEscapedCharacters("Line1\\nLine2\\tTabbed\\\\Backslash"),
    ).toBe("Line1\nLine2\tTabbed\\Backslash");
  });

  it("should handle strings without escaped characters", () => {
    expect(replaceEscapedCharacters("Hello World")).toBe("Hello World");
  });

  it("should handle empty strings", () => {
    expect(replaceEscapedCharacters("")).toBe("");
  });

  it("should not replace invalid escape sequences", () => {
    expect(replaceEscapedCharacters("Hello\\xWorld")).toBe("Hello\\xWorld");
  });
});

describe("escapeForSVG", () => {
  it("should escape XML entities", () => {
    expect(escapeForSVG("Hello & World")).toBe("Hello &amp; World");
    expect(escapeForSVG("Hello < World")).toBe("Hello &lt; World");
    expect(escapeForSVG("Hello > World")).toBe("Hello &gt; World");
    expect(escapeForSVG('Hello "World"')).toBe("Hello &quot;World&quot;");
    expect(escapeForSVG("Hello 'World'")).toBe("Hello &apos;World&apos;");
  });

  it("should escape whitespace characters as literal escape sequences", () => {
    expect(escapeForSVG("Hello\nWorld")).toBe("Hello\\nWorld");
    expect(escapeForSVG("Hello\tWorld")).toBe("Hello\\tWorld");
    expect(escapeForSVG("Hello\rWorld")).toBe("Hello\\rWorld");
  });

  it("should handle multiple types of characters together", () => {
    expect(escapeForSVG("Line1\nLine2&<>\"'Tab\tHere")).toBe(
      "Line1\\nLine2&amp;&lt;&gt;&quot;&apos;Tab\\tHere",
    );
  });

  it("should handle empty strings", () => {
    expect(escapeForSVG("")).toBe("");
  });

  it("should handle strings with only whitespace characters", () => {
    expect(escapeForSVG("\n\t\r")).toBe("\\n\\t\\r");
  });

  it("should handle strings without special characters", () => {
    expect(escapeForSVG("Hello World 123")).toBe("Hello World 123");
  });

  it("should handle complex multiline code examples", () => {
    const codeExample = `function test() {
  console.log("Hello & World");
  return true;
}`;
    const expected = `function test() {\\n  console.log(&quot;Hello &amp; World&quot;);\\n  return true;\\n}`;
    expect(escapeForSVG(codeExample)).toBe(expected);
  });

  it("should handle edge case with all escape types", () => {
    expect(escapeForSVG("&<>\"'\n\t\r")).toBe(
      "&amp;&lt;&gt;&quot;&apos;\\n\\t\\r",
    );
  });
});

describe("kebabOfStr", () => {
  it("should convert camelCase to kebab-case", () => {
    expect(kebabOfStr("camelCase")).toBe("camel-case");
    expect(kebabOfStr("someVariableName")).toBe("some-variable-name");
  });

  it("should convert PascalCase to kebab-case", () => {
    expect(kebabOfStr("PascalCase")).toBe("pascal-case");
    expect(kebabOfStr("SomeClassName")).toBe("some-class-name");
  });

  it("should convert spaces to hyphens", () => {
    expect(kebabOfStr("hello world")).toBe("hello-world");
    expect(kebabOfStr("multiple   spaces")).toBe("multiple-spaces");
  });

  it("should convert underscores to hyphens", () => {
    expect(kebabOfStr("snake_case")).toBe("snake-case");
    expect(kebabOfStr("multiple___underscores")).toBe("multiple-underscores");
  });

  it("should convert mixed formats", () => {
    expect(kebabOfStr("mixedCase_with spaces")).toBe("mixed-case-with-spaces");
    expect(kebabOfStr("PascalCase_Snake SPACE")).toBe(
      "pascal-case-snake-space",
    );
  });

  it("should handle already kebab-case strings", () => {
    expect(kebabOfStr("already-kebab")).toBe("already-kebab");
  });

  it("should handle strings with numbers", () => {
    expect(kebabOfStr("version2Beta")).toBe("version2-beta");
    expect(kebabOfStr("test123Case")).toBe("test123-case");
  });

  it("should handle empty strings", () => {
    expect(kebabOfStr("")).toBe("");
  });

  it("should handle single characters", () => {
    expect(kebabOfStr("A")).toBe("a");
    expect(kebabOfStr("a")).toBe("a");
  });

  it("should handle special characters", () => {
    expect(kebabOfStr("hello@world")).toBe("hello@world");
    expect(kebabOfStr("test.file.name")).toBe("test.file.name");
  });

  it("should convert to lowercase", () => {
    expect(kebabOfStr("UPPERCASE")).toBe("uppercase");
    expect(kebabOfStr("MiXeD cAsE")).toBe("mi-xe-d-c-as-e");
  });
});

describe("kebabOfThemeStr", () => {
  it("should convert spaces to hyphens", () => {
    expect(kebabOfThemeStr("hello world")).toBe("hello-world");
    expect(kebabOfThemeStr("multiple   spaces")).toBe("multiple-spaces");
  });

  it("should convert underscores to hyphens", () => {
    expect(kebabOfThemeStr("snake_case")).toBe("snake-case");
    expect(kebabOfThemeStr("multiple___underscores")).toBe(
      "multiple-underscores",
    );
  });

  it("should convert mixed spaces and underscores", () => {
    expect(kebabOfThemeStr("mixed_ case")).toBe("mixed-case");
    expect(kebabOfThemeStr("theme name_variant")).toBe("theme-name-variant");
  });

  it("should convert to lowercase", () => {
    expect(kebabOfThemeStr("UPPERCASE")).toBe("uppercase");
    expect(kebabOfThemeStr("MiXeD CaSe")).toBe("mixed-case");
  });

  it("should handle already kebab-case strings", () => {
    expect(kebabOfThemeStr("already-kebab")).toBe("already-kebab");
  });

  it("should handle empty strings", () => {
    expect(kebabOfThemeStr("")).toBe("");
  });

  it("should handle single characters", () => {
    expect(kebabOfThemeStr("A")).toBe("a");
    expect(kebabOfThemeStr("a")).toBe("a");
  });

  it("should preserve other special characters", () => {
    expect(kebabOfThemeStr("hello@world")).toBe("hello@world");
    expect(kebabOfThemeStr("test.file.name")).toBe("test.file.name");
  });

  it("should not convert camelCase (unlike kebabOfStr)", () => {
    expect(kebabOfThemeStr("camelCase")).toBe("camelcase");
    expect(kebabOfThemeStr("PascalCase")).toBe("pascalcase");
  });

  it("should handle strings with numbers", () => {
    expect(kebabOfThemeStr("theme_v2 beta")).toBe("theme-v2-beta");
    expect(kebabOfThemeStr("version_123_FINAL")).toBe("version-123-final");
  });

  it("should handle strings with parentheses", () => {
    expect(kebabOfThemeStr("theme_v2 (beta)")).toBe("theme-v2-beta");
    expect(kebabOfThemeStr("Gruvbox Dark (Hard)")).toBe("gruvbox-dark-hard");
  });
});
