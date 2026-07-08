import { RangeInFileWithContents, SymbolWithRange } from "core";

const terminalLanguages = ["bash", "sh"];
const commonTerminalCommands = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "npx",
  "cd",
  "ls",
  "pwd",
  "pip",
  "python",
  "node",
  "git",
  "curl",
  "wget",
  "rbenv",
  "gem",
  "ruby",
  "bundle",
];

export function isTerminalCodeBlock(
  language: string | undefined | null,
  text: string,
) {
  return (
    (language && terminalLanguages.includes(language)) ||
    ((!language || language?.length === 0) &&
      (text.trim().split("\n").length === 1 ||
        commonTerminalCommands.some((c) => text.trim().startsWith(c))))
  );
}

function childToText(child: any): string {
  if (typeof child === "string") {
    return child;
  } else if (child?.props) {
    return childToText(child.props?.children);
  } else if (Array.isArray(child)) {
    return childrenToText(child);
  } else {
    return "";
  }
}

export function childrenToText(children: any) {
  return children.map((child: any) => childToText(child)).join("");
}

export function matchCodeToSymbolOrFile(
  content: string,
  symbols: SymbolWithRange[],
  rifs: RangeInFileWithContents[],
): SymbolWithRange | RangeInFileWithContents | undefined {
  // Insert file links for matching previous context items
  // With some reasonable limitations on what might be a filename
  if (rifs.length && content.includes(".") && content.length > 2) {
    const match = rifs.find(
      (rif) => rif.filepath.split("/").pop() === content, // Exact match for last segment of URI
    );

    if (match) {
      return match;
    }
  }

  // Insert symbols for exact matches
  const exactSymbol = symbols.find((s) => s.name === content);
  if (exactSymbol) {
    return exactSymbol;
  }

  // Partial matches - this is the case where the llm returns e.g. `subtract(number)` instead of `subtract`
  const partialSymbol = symbols.find((s) => content.startsWith(s.name));
  if (partialSymbol) {
    return partialSymbol;
  }
}

export function isSymbolNotRif(
  item: SymbolWithRange | RangeInFileWithContents,
): item is SymbolWithRange {
  return (item as SymbolWithRange).type !== undefined;
}
