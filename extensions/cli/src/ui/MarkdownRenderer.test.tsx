import { Text } from "ink";
import React from "react";

import { MarkdownRenderer } from "./MarkdownRenderer.js";

describe("MarkdownRenderer", () => {
  // Helper function to simulate calling the component function directly
  function renderMarkdown(content: string) {
    // Handle React.memo wrapped component by casting to any to access .type
    const ComponentType = (MarkdownRenderer as any).type || MarkdownRenderer;
    const component = ComponentType({ content });
    return (component as any).props.children;
  }

  it("renders plain text without formatting", () => {
    const result = renderMarkdown("Hello world");
    expect(result).toEqual(["Hello world"]);
  });

  it("renders bold text", () => {
    const result = renderMarkdown("This is **bold** text");
    expect(result.length).toBe(3);
    expect(result[0]).toBe("This is ");
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as any).props.bold).toBe(true);
    expect((result[1] as any).props.children).toBe("bold");
    expect(result[2]).toBe(" text");
  });

  it("renders italic text with asterisks", () => {
    const result = renderMarkdown("This is *italic* text");
    expect(result.length).toBe(3);
    expect(result[0]).toBe("This is ");
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as any).props.italic).toBe(true);
    expect((result[1] as any).props.children).toBe("italic");
    expect(result[2]).toBe(" text");
  });

  it("renders italic text with underscores", () => {
    const result = renderMarkdown("This is _italic_ text");
    expect(result.length).toBe(3);
    expect(result[0]).toBe("This is ");
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as any).props.italic).toBe(true);
    expect((result[1] as any).props.children).toBe("italic");
    expect(result[2]).toBe(" text");
  });

  it("renders strikethrough text", () => {
    const result = renderMarkdown("This is ~~strikethrough~~ text");
    expect(result.length).toBe(3);
    expect(result[0]).toBe("This is ");
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as any).props.strikethrough).toBe(true);
    expect((result[1] as any).props.children).toBe("strikethrough");
    expect(result[2]).toBe(" text");
  });

  it("renders code text", () => {
    const result = renderMarkdown("This is `code` text");
    expect(result.length).toBe(3);
    expect(result[0]).toBe("This is ");
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as any).props.color).toBe("magentaBright");
    expect((result[1] as any).props.children).toBe("code");
    expect(result[2]).toBe(" text");
  });

  it("handles empty string", () => {
    const result = renderMarkdown("");
    expect(result).toEqual([]);
  });

  it("handles text without formatting", () => {
    const result = renderMarkdown("Just plain text");
    expect(result).toEqual(["Just plain text"]);
  });

  it("handles multiple formatting types", () => {
    const result = renderMarkdown("**Bold** and *italic*");
    expect(result.length).toBe(3);
    expect((result[0] as any).props.bold).toBe(true);
    expect((result[0] as any).props.children).toBe("Bold");
    expect(result[1]).toBe(" and ");
    expect((result[2] as any).props.italic).toBe(true);
    expect((result[2] as any).props.children).toBe("italic");
  });

  // Test the overlapping pattern handling
  it("handles overlapping patterns by prioritizing first match", () => {
    const result = renderMarkdown("**bold*italic**");
    // Should now match bold pattern and render "bold*italic" as bold
    expect(result.length).toBe(1);
    expect(React.isValidElement(result[0])).toBe(true);
    expect((result[0] as any).props.bold).toBe(true);
    expect((result[0] as any).props.children).toBe("bold*italic");
  });

  describe("Heading formatting", () => {
    it("renders h1 heading as bold", () => {
      const result = renderMarkdown("# Main Title");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe("Main Title");
    });

    it("renders h2 heading as bold", () => {
      const result = renderMarkdown("## Section Title");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe("Section Title");
    });

    it("renders h3 heading as bold", () => {
      const result = renderMarkdown("### Subsection");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe("Subsection");
    });

    it("renders h6 heading as bold", () => {
      const result = renderMarkdown("###### Deep Heading");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe("Deep Heading");
    });

    it("handles headings with multiple words", () => {
      const result = renderMarkdown(
        "# This is a long heading with multiple words",
      );
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe(
        "This is a long heading with multiple words",
      );
    });

    it("handles mixed content with headings", () => {
      const result = renderMarkdown("# Title\nNormal text **bold** text");
      expect(result.length).toBe(4);
      expect((result[0] as any).props.bold).toBe(true);
      expect((result[0] as any).props.children).toBe("Title");
      expect(result[1]).toBe("\nNormal text ");
      expect((result[2] as any).props.bold).toBe(true);
      expect((result[2] as any).props.children).toBe("bold");
      expect(result[3]).toBe(" text");
    });
  });

  describe("Code block formatting", () => {
    it("renders code blocks with triple backticks", () => {
      const result = renderMarkdown("```\nconst x = 1;\nconsole.log(x);\n```");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      // The result should be a Text element containing syntax highlighted code
      expect((result[0] as any).type).toBe(Text);
      expect((result[0] as any).props.children).toBeDefined();
      expect(Array.isArray((result[0] as any).props.children)).toBe(true);
    });

    it("renders single line code blocks", () => {
      const result = renderMarkdown("```console.log('hello')```");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).type).toBe(Text);
      expect((result[0] as any).props.children).toBeDefined();
    });

    it("renders code blocks with language specification", () => {
      const result = renderMarkdown("```javascript\nconst x = 1;\n```");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).type).toBe(Text);
      expect((result[0] as any).props.children).toBeDefined();
    });

    it("handles code blocks mixed with other formatting", () => {
      const result = renderMarkdown(
        "Here's some code:\n```\nfunction test() {\n  return 42;\n}\n```\nAnd **bold** text",
      );
      expect(result.length).toBe(5);
      expect(result[0]).toBe("Here's some code:\n");
      expect(React.isValidElement(result[1])).toBe(true);
      expect((result[1] as any).type).toBe(Text);
      expect(result[2]).toBe("\nAnd ");
      expect((result[3] as any).props.bold).toBe(true);
      expect((result[3] as any).props.children).toBe("bold");
      expect(result[4]).toBe(" text");
    });

    it("handles empty code blocks", () => {
      const result = renderMarkdown("``````");
      expect(result.length).toBe(1);
      expect(React.isValidElement(result[0])).toBe(true);
      expect((result[0] as any).type).toBe(Text);
    });
  });
});
