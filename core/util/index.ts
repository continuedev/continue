import Handlebars from "handlebars";
import { ChatMessage } from "..";

export function removeQuotesAndEscapes(output: string): string {
  output = output.trim();

  // Replace smart quotes
  output = output.replace("“", '"');
  output = output.replace("”", '"');
  output = output.replace("‘", "'");
  output = output.replace("’", "'");

  // Remove escapes
  output = output.replace('\\"', '"');
  output = output.replace("\\'", "'");
  output = output.replace("\\n", "\n");
  output = output.replace("\\t", "\t");
  output = output.replace("\\\\", "\\");
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

export function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!(window as any)._fetch) {
    throw new Error("Proxy fetch not initialized");
  }

  if (!(url.startsWith("http://") || url.startsWith("https://"))) {
    // Relative URL
    const fullUrl = `${window.vscMediaUrl}/${url}`;
    return (window as any)._fetch(fullUrl, init);
  }

  const proxyServerUrl =
    (window as any).proxyServerUrl || "http://localhost:65433";

  const headers = new Headers(init?.headers);
  headers.append("x-continue-url", url);

  return (window as any)._fetch(proxyServerUrl, {
    ...init,
    headers,
  });
}

export function dedentAndGetCommonWhitespace(s: string): [string, string] {
  let lines = s.split("\n");
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
      if (j >= lines[i].length || lcp[j] != lines[i][j]) {
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

export type PromptTemplate =
  | string
  | ((
      history: ChatMessage[],
      otherData: Record<string, string>,
    ) => string | ChatMessage[]);

export function renderPromptTemplate(
  template: PromptTemplate,
  history: ChatMessage[],
  otherData: Record<string, string>,
): string | ChatMessage[] {
  if (typeof template === "string") {
    let data: any = {
      history: history,
      ...otherData,
    };
    if (history.length > 0 && history[0].role == "system") {
      data["system_message"] = history.shift()!.content;
    }

    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(data);
  } else {
    return template(history, otherData);
  }
}

export function getBasename(filepath: string, n: number = 1): string {
  return filepath.split(/[\\/]/).pop() || "";
}

export function getLastNPathParts(filepath: string, n: number): string {
  return filepath.split(/[\\/]/).slice(-n).join("/");
}

export function getMarkdownLanguageTagForFile(filepath: string): string {
  const ext = filepath.split(".").pop();
  switch (ext) {
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "tsx":
      return "tsx";
    case "ts":
      return "typescript";
    case "java":
      return "java";
    case "go":
      return "go";
    case "rb":
      return "ruby";
    case "rs":
      return "rust";
    case "c":
      return "c";
    case "cpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "php":
      return "php";
    case "scala":
      return "scala";
    case "swift":
      return "swift";
    case "kt":
      return "kotlin";
    case "md":
      return "markdown";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sh":
      return "shell";
    case "yaml":
      return "yaml";
    case "toml":
      return "toml";
    case "tex":
      return "latex";
    case "sql":
      return "sql";
    default:
      return "";
  }
}

export function copyOf(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}
