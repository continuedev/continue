import { Text } from "ink";
import { common, createLowlight } from "lowlight";
import React from "react";

export interface SyntaxHighlighterTheme {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  operator: string;
  punctuation: string;
  function: string;
  variable: string;
  property: string;
  class: string;
  constant: string;
  regex: string;
  default: string;
}

export const defaultTheme: SyntaxHighlighterTheme = {
  keyword: "magenta",
  string: "green",
  comment: "gray",
  number: "cyan",
  operator: "white",
  punctuation: "white",
  function: "yellow",
  variable: "white",
  property: "blue",
  class: "yellow",
  constant: "cyan",
  regex: "red",
  default: "white",
};

// Map highlight.js token types to theme colors
const tokenColorMap: Record<string, keyof SyntaxHighlighterTheme> = {
  keyword: "keyword",
  string: "string",
  comment: "comment",
  number: "number",
  operator: "operator",
  punctuation: "punctuation",
  function: "function",
  variable: "variable",
  property: "property",
  class: "class",
  constant: "constant",
  regexp: "regex",
  boolean: "constant",
  null: "constant",
  undefined: "constant",
  builtin: "keyword",
  tag: "keyword",
  attr: "property",
  attribute: "property",
  selector: "property",
  important: "keyword",
  atrule: "keyword",
  rule: "keyword",
  entity: "constant",
  url: "string",
  symbol: "constant",
  prolog: "comment",
  doctype: "comment",
  cdata: "comment",
  title: "function",
  section: "keyword",
  name: "function",
  strong: "keyword",
  emphasis: "string",
  quote: "string",
  built_in: "keyword",
  literal: "constant",
  type: "class",
  params: "variable",
  meta: "comment",
  link: "string",
};

export function highlightCode(
  code: string,
  language: string = "javascript",
  theme: SyntaxHighlighterTheme = defaultTheme,
): React.ReactNode[] {
  try {
    // Create lowlight instance with common languages
    const lowlight = createLowlight(common);

    const result = lowlight.highlight(language, code, { prefix: "" });

    // Convert the hast tree to React elements
    const elements: React.ReactNode[] = [];

    let keyCounter = 0;

    function processNode(
      node: any,
      parentColor: string = theme.default,
    ): React.ReactNode {
      if (node.type === "text") {
        const text = node.value;
        if (text) {
          return React.createElement(
            Text,
            {
              key: `text-${keyCounter++}`,
              color: parentColor,
            },
            text,
          );
        }
        return null;
      }

      if (node.type === "element") {
        const className = node.properties?.className || [];

        // Extract token type from class names
        let tokenType = "";
        for (const cls of className) {
          if (tokenColorMap[cls]) {
            tokenType = cls;
            break;
          }
        }

        // Get color from theme
        const colorKey = tokenColorMap[tokenType] || "default";
        const color = theme[colorKey];

        if (node.children && node.children.length > 0) {
          // Process child nodes with this color
          const children: React.ReactNode[] = [];
          for (let i = 0; i < node.children.length; i++) {
            const child = processNode(node.children[i], color);
            if (!child) continue;

            if (Array.isArray(child)) {
              children.push(...child);
            } else {
              children.push(child);
            }
          }

          return children;
        }

        const textContent = getTextContent(node);
        if (textContent) {
          return React.createElement(
            Text,
            {
              key: `element-${keyCounter++}`,
              color,
            },
            textContent,
          );
        }
      }

      return null;
    }

    // Helper function to extract text content from a node
    function getTextContent(node: any): string {
      if (node.type === "text") {
        return node.value || "";
      }

      if (node.type === "element" && node.children) {
        return node.children.map(getTextContent).join("");
      }

      return "";
    }

    // Process all child nodes
    if (result.children) {
      for (let i = 0; i < result.children.length; i++) {
        const element = processNode(result.children[i]);
        if (!element) continue;

        if (Array.isArray(element)) {
          elements.push(...element);
        } else {
          elements.push(element);
        }
      }
    }

    return elements;
  } catch {
    // Fallback to plain text on error
    return [
      React.createElement(
        Text,
        { key: "error-fallback", color: theme.default },
        code,
      ),
    ];
  }
}

export function detectLanguage(code: string): string {
  // Simple language detection based on common patterns
  const patterns = [
    { regex: /^\s*import\s+.*from\s+['"]/, language: "javascript" },
    { regex: /^\s*const\s+\w+\s*=\s*require\s*\(/, language: "javascript" },
    { regex: /^\s*function\s+\w+\s*\(/, language: "javascript" },
    { regex: /^\s*interface\s+\w+/, language: "typescript" },
    { regex: /^\s*type\s+\w+\s*=/, language: "typescript" },
    { regex: /^\s*def\s+\w+.*:/, language: "python" },
    { regex: /^\s*class\s+\w+.*:/, language: "python" },
    { regex: /^\s*public\s+class\s+\w+/, language: "java" },
    { regex: /^\s*#include\s*</, language: "c" },
    { regex: /^\s*using\s+namespace\s+/, language: "cpp" },
    { regex: /^\s*using\s+System\s*;/, language: "csharp" },
    { regex: /^\s*package\s+main/, language: "go" },
    { regex: /^\s*fn\s+\w+\s*\(/, language: "rust" },
    { regex: /^\s*<\?php/, language: "php" },
    { regex: /^\s*SELECT\s+.*FROM\s+/i, language: "sql" },
    { regex: /^\s*\{\s*$/, language: "json" },
    { regex: /^\s*---\s*$/, language: "yaml" },
    { regex: /^\s*#!/, language: "bash" },
    { regex: /^\s*<(!DOCTYPE html|html)/i, language: "html" },
    { regex: /^\s*@media\s+/, language: "css" },
    { regex: /^\s*#\s+/, language: "markdown" },
  ];

  // Check patterns line by line for multiline code
  const lines = code.split("\n");
  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        return pattern.language;
      }
    }
  }

  return "javascript"; // default fallback
}
