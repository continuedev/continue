import Handlebars from "handlebars";
import { ChatMessage } from "../llm/types";

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
  if (
    (output.startsWith('"') && output.endsWith('"')) ||
    (output.startsWith("'") && output.endsWith("'"))
  ) {
    output = output.slice(1, -1);
  }

  return output;
}

export function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!(window as any)._fetch) {
    throw new Error("Proxy fetch not initialized");
  }

  const headers = new Headers(init?.headers);
  headers.append("x-continue-url", url);

  return (window as any)._fetch("http://localhost:65433", {
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

  return [lines.map((x) => x.replace(lcp, "")).join("\n"), lcp];
}

type PromptTemplate =
  | string
  | ((
      history: ChatMessage[],
      otherData: Record<string, string>
    ) => string | ChatMessage[]);

export function renderPromptTemplate(
  template: PromptTemplate,
  history: ChatMessage[],
  otherData: Record<string, string>
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
