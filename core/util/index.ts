export function removeQuotesAndEscapes(input: string): string {
  let output = input.trim();

  // Replace smart quotes
  output = output.replaceAll("“", '"');
  output = output.replaceAll("”", '"');
  output = output.replaceAll("‘", "'");
  output = output.replaceAll("’", "'");

  // Remove escapes
  output = output.replaceAll('\\"', '"');
  output = output.replaceAll("\\'", "'");
  output = output.replaceAll("\\n", "\n");
  output = output.replaceAll("\\t", "\t");
  output = output.replaceAll("\\\\", "\\");
  while (
    (output.startsWith('"') && output.endsWith('"')) ||
    (output.startsWith("'") && output.endsWith("'"))
  ) {
    output = output.slice(1, -1);
  }

  while (output.startsWith("`") && output.endsWith("`")) {
    output = output.slice(1, -1);
  }

  return output;
}

export function dedentAndGetCommonWhitespace(s: string): [string, string] {
  const lines = s.split("\n");
  if (lines.length === 0 || (lines[0].trim() === "" && lines.length === 1)) {
    return ["", ""];
  }

  // Longest common whitespace prefix
  let lcp = lines[0].split(lines[0].trim())[0];
  // Iterate through the lines
  for (let i = 1; i < lines.length; i++) {
    // Empty lines are wildcards
    if (lines[i].trim() === "") {
      continue; // hey that's us!
    }

    if (lcp === undefined) {
      lcp = lines[i].split(lines[i].trim())[0];
    }

    // Iterate through the leading whitespace characters of the current line
    for (let j = 0; j < lcp.length; j++) {
      // If it doesn't have the same whitespace as lcp, then update lcp
      if (j >= lines[i].length || lcp[j] !== lines[i][j]) {
        lcp = lcp.slice(0, j);
        if (lcp === "") {
          return [s, ""];
        }
        break;
      }
    }
  }

  if (lcp === undefined) {
    return [s, ""];
  }

  return [lines.map((x) => x.replace(lcp, "")).join("\n"), lcp];
}

export function getMarkdownLanguageTagForFile(filepath: string): string {
  const extToLangMap: { [key: string]: string } = {
    py: "python",
    js: "javascript",
    jsx: "jsx",
    tsx: "tsx",
    ts: "typescript",
    java: "java",
    class: "java", //.class files decompile to Java
    go: "go",
    rb: "ruby",
    rs: "rust",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    scala: "scala",
    swift: "swift",
    kt: "kotlin",
    md: "markdown",
    json: "json",
    html: "html",
    css: "css",
    sh: "shell",
    yaml: "yaml",
    toml: "toml",
    tex: "latex",
    sql: "sql",
    ps1: "powershell",
  };

  const ext = sanitizeExtension(filepath.split(".").pop());
  return ext ? (extToLangMap[ext] ?? ext) : "";
}

function sanitizeExtension(ext?: string): string | undefined {
  if (ext) {
    //ignore ranges in extension eg. "java (11-23)"
    const match = ext.match(/^(\S+)\s*(\(.*\))?$/);
    if (match) {
      ext = match[1];
    }
  }
  return ext;
}

export function copyOf(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

export function deduplicateArray<T>(
  array: T[],
  equal: (a: T, b: T) => boolean,
): T[] {
  const result: T[] = [];

  for (const item of array) {
    if (!result.some((existingItem) => equal(existingItem, item))) {
      result.push(item);
    }
  }

  return result;
}

export type TODO = any;

export function dedent(strings: TemplateStringsArray, ...values: any[]) {
  let raw = "";
  for (let i = 0; i < strings.length; i++) {
    raw += strings[i];

    // Handle the value if it exists
    if (i < values.length) {
      let value = String(values[i]);
      // If the value contains newlines, we need to adjust the indentation
      if (value.includes("\n")) {
        // Find the indentation level of the last line in strings[i]
        let lines = strings[i].split("\n");
        let lastLine = lines[lines.length - 1];
        let match = lastLine.match(/(^|\n)([^\S\n]*)$/);
        let indent = match ? match[2] : "";
        // Add indentation to all lines except the first line of value
        let valueLines = value.split("\n");
        valueLines = valueLines.map((line, index) =>
          index === 0 ? line : indent + line,
        );
        value = valueLines.join("\n");
      }
      raw += value;
    }
  }

  // Now dedent the full string
  let result = raw.replace(/^\n/, "").replace(/\n\s*$/, "");
  let lines = result.split("\n");

  // Remove leading/trailing blank lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  // Calculate minimum indentation (excluding empty lines)
  let minIndent = lines.reduce((min: any, line: any) => {
    if (line.trim() === "") return min;
    let match = line.match(/^(\s*)/);
    let indent = match ? match[1].length : 0;
    return min === null ? indent : Math.min(min, indent);
  }, null);

  if (minIndent !== null && minIndent > 0) {
    // Remove the minimum indentation from each line
    lines = lines.map((line) => line.slice(minIndent));
  }

  return lines.join("\n");
}

/**
 * Removes code blocks from a message.
 *
 * Return modified message text.
 */
export function removeCodeBlocksAndTrim(text: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const thinkBlockRegex = /<think>[\s\S]*?<\/think>/g;

  // Remove code blocks and think blocks from the message text
  let processedText = text.replace(codeBlockRegex, "");
  processedText = processedText.replace(thinkBlockRegex, "");

  return processedText.trim();
}

export function splitCamelCaseAndNonAlphaNumeric(value: string) {
  return value
    .split(/(?<=[a-z0-9])(?=[A-Z])|[^a-zA-Z0-9]/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}
