import {
  ContextItem,
  DocumentSymbol,
  IDE,
  Position,
  Problem,
  RangeInFile,
  WorkspaceSymbol,
} from "../..";
import { isSecurityConcern } from "../../indexing/ignore";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { resolveInputPath } from "../../util/pathResolver";
import { findUriInDirs } from "../../util/uri";
import { getNumberArg, getStringArg } from "../parseArgs";

import { ToolImpl } from ".";

export const CODE_NAVIGATION_OPERATIONS = [
  "symbols",
  "outline",
  "definition",
  "type_definition",
  "references",
  "problems",
] as const;
export type CodeNavigationOperation =
  (typeof CODE_NAVIGATION_OPERATIONS)[number];

/** Result caps, so one call never floods the context. */
export const LIMITS = {
  symbols: 30,
  outline: 200,
  definitions: 5,
  definitionLines: 15,
  references: 50,
  problems: 50,
};

// core's SymbolKind numbering (VS Code's: File = 0)
const KIND_NAMES = [
  "file",
  "module",
  "namespace",
  "package",
  "class",
  "method",
  "property",
  "field",
  "constructor",
  "enum",
  "interface",
  "function",
  "variable",
  "constant",
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "key",
  "null",
  "enum member",
  "struct",
  "event",
  "operator",
  "type parameter",
];

export function kindName(kind: number): string {
  return KIND_NAMES[kind] ?? "symbol";
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Where `symbol` is in a file: on `line` (1-based) when given, else its
 * first occurrence as a whole word. The position is 0-based, at the
 * symbol's first character, which is where language servers expect it.
 */
export function locateSymbol(
  contents: string,
  symbol: string,
  line?: number,
): Position | undefined {
  const lines = contents.split(/\r?\n/);
  const word = /^\w/.test(symbol) && /\w$/.test(symbol);
  const pattern = new RegExp(
    word ? `\\b${escapeRegExp(symbol)}\\b` : escapeRegExp(symbol),
  );
  const find = (i: number) => {
    const m = pattern.exec(lines[i] ?? "");
    return m ? { line: i, character: m.index } : undefined;
  };
  if (line !== undefined) {
    // The given line first, then a couple either side (models are often off by one)
    for (const d of [0, -1, 1, -2, 2]) {
      const hit = find(line - 1 + d);
      if (hit) return hit;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const hit = find(i);
    if (hit) return hit;
  }
  return undefined;
}

type FileReader = (uri: string) => Promise<string[] | undefined>;

/** Reads each file once per call; files that should not be shown give undefined. */
function fileReader(ide: IDE): FileReader {
  const cache = new Map<string, Promise<string[] | undefined>>();
  return (uri) => {
    let lines = cache.get(uri);
    if (!lines) {
      lines = (async () => {
        if (isSecurityConcern(uri)) return undefined;
        try {
          return (await ide.readFile(uri)).split(/\r?\n/);
        } catch {
          return undefined;
        }
      })();
      cache.set(uri, lines);
    }
    return lines;
  };
}

function relative(uri: string, dirs: string[]): string {
  try {
    return findUriInDirs(uri, dirs).relativePathOrBasename;
  } catch {
    return uri;
  }
}

export function formatSymbols(
  symbols: WorkspaceSymbol[],
  query: string,
  dirs: string[],
): string {
  if (symbols.length === 0) {
    return `No symbols match "${query}". Try a shorter or differently cased name, or grep_search.`;
  }
  // Exact name matches first, then the rest in the language server's order
  const exact = symbols.filter((s) => s.name === query);
  const ordered = [...exact, ...symbols.filter((s) => s.name !== query)];
  const shown = ordered.slice(0, LIMITS.symbols);
  const lines = shown.map((s) => {
    const where = `${relative(s.location.filepath, dirs)}:${s.location.range.start.line + 1}`;
    const container = s.containerName ? ` in ${s.containerName}` : "";
    return `- ${s.name} (${kindName(s.kind)}${container}) ${where}`;
  });
  const more =
    symbols.length > shown.length
      ? `\n(${symbols.length - shown.length} more; narrow the query)`
      : "";
  return `Symbols matching "${query}":\n${lines.join("\n")}${more}`;
}

/** The file's symbols, nested by range, with 1-based line numbers. */
export function formatOutline(
  symbols: DocumentSymbol[],
  displayPath: string,
): string {
  if (symbols.length === 0) {
    return `No symbols in ${displayPath}: no language server answered for this file type, or the file is empty.`;
  }
  const sorted = [...symbols].sort(
    (a, b) =>
      a.range.start.line - b.range.start.line ||
      a.range.start.character - b.range.start.character ||
      b.range.end.line - a.range.end.line,
  );
  const open: DocumentSymbol[] = [];
  const lines: string[] = [];
  for (const s of sorted.slice(0, LIMITS.outline)) {
    while (
      open.length &&
      open[open.length - 1].range.end.line < s.range.start.line
    ) {
      open.pop();
    }
    const detail = s.detail ? ` — ${s.detail}` : "";
    lines.push(
      `${"  ".repeat(open.length)}${s.range.start.line + 1}: ${kindName(s.kind)} ${s.name}${detail}`,
    );
    open.push(s);
  }
  const more =
    sorted.length > LIMITS.outline
      ? `\n(${sorted.length - LIMITS.outline} more symbols not shown)`
      : "";
  return `Outline of ${displayPath} (line: kind name):\n${lines.join("\n")}${more}`;
}

async function formatLocations(
  label: string,
  locations: RangeInFile[],
  dirs: string[],
  read: FileReader,
): Promise<string> {
  const shown = locations.slice(0, LIMITS.definitions);
  const blocks = await Promise.all(
    shown.map(async (loc) => {
      const start = loc.range.start.line;
      const where = `${relative(loc.filepath, dirs)}:${start + 1}`;
      const lines = await read(loc.filepath);
      if (!lines) return where;
      const end = Math.min(
        Math.max(loc.range.end.line, start),
        start + LIMITS.definitionLines - 1,
      );
      const body = lines
        .slice(start, end + 1)
        .map((l, i) => `${start + i + 1}| ${l}`)
        .join("\n");
      return `${where}\n${body}`;
    }),
  );
  const more =
    locations.length > shown.length
      ? `\n(${locations.length - shown.length} more)`
      : "";
  return `${label}:\n\n${blocks.join("\n\n")}${more}`;
}

async function formatReferences(
  symbol: string,
  refs: RangeInFile[],
  dirs: string[],
  read: FileReader,
): Promise<string> {
  if (refs.length === 0) return `No references to ${symbol} found.`;
  const shown = refs.slice(0, LIMITS.references);
  const lines = await Promise.all(
    shown.map(async (r) => {
      const where = `${relative(r.filepath, dirs)}:${r.range.start.line + 1}`;
      const text = (await read(r.filepath))?.[r.range.start.line]?.trim();
      return text ? `${where}: ${text}` : where;
    }),
  );
  const files = new Set(refs.map((r) => r.filepath)).size;
  const more =
    refs.length > shown.length ? `\n(${refs.length - shown.length} more)` : "";
  return `${refs.length} reference${refs.length === 1 ? "" : "s"} to ${symbol} in ${files} file${files === 1 ? "" : "s"}:\n${lines.join("\n")}${more}`;
}

const SEVERITY_ORDER = ["error", "warning", "information", "hint"];

export function formatProblems(
  problems: Problem[],
  displayPath: string,
  dirs: string[],
): string {
  if (problems.length === 0) return `No problems reported in ${displayPath}.`;
  const sorted = [...problems].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity ?? "error") -
        SEVERITY_ORDER.indexOf(b.severity ?? "error") ||
      a.range.start.line - b.range.start.line,
  );
  const shown = sorted.slice(0, LIMITS.problems);
  const lines = shown.map((p) => {
    const where = `${relative(p.filepath, dirs)}:${p.range.start.line + 1}:${p.range.start.character + 1}`;
    const source = p.source ? ` [${p.source}]` : "";
    return `${where} ${p.severity ?? "problem"}${source}: ${p.message}`;
  });
  const more =
    problems.length > shown.length
      ? `\n(${problems.length - shown.length} more)`
      : "";
  return `Problems in ${displayPath}:\n${lines.join("\n")}${more}`;
}

async function resolveFile(ide: IDE, filepath: string) {
  const resolved = await resolveInputPath(ide, filepath);
  if (!resolved || !(await ide.fileExists(resolved.uri))) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `File "${filepath}" does not exist. Check the path, relative to the workspace root.`,
    );
  }
  return resolved;
}

function item(name: string, content: string): ContextItem[] {
  return [{ name, description: name, content }];
}

export const codeNavigationImpl: ToolImpl = async (args, extras) => {
  const { ide } = extras;
  const operation = getStringArg(args, "operation") as CodeNavigationOperation;
  if (!CODE_NAVIGATION_OPERATIONS.includes(operation)) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      `Unknown operation "${operation}". Use one of: ${CODE_NAVIGATION_OPERATIONS.join(", ")}.`,
    );
  }
  const dirs = await ide.getWorkspaceDirs();
  const read = fileReader(ide);

  if (operation === "symbols") {
    const query = getStringArg(args, "symbol");
    const symbols = await ide.getWorkspaceSymbols(query);
    return item(`Symbols: ${query}`, formatSymbols(symbols, query, dirs));
  }

  const filepath = getStringArg(args, "filepath");
  const file = await resolveFile(ide, filepath);

  if (operation === "outline") {
    const symbols = await ide.getDocumentSymbols(file.uri);
    return item(
      `Outline: ${file.displayPath}`,
      formatOutline(symbols, file.displayPath),
    );
  }

  if (operation === "problems") {
    const problems = await ide.getProblems(file.uri);
    return item(
      `Problems: ${file.displayPath}`,
      formatProblems(problems, file.displayPath, dirs),
    );
  }

  // definition, type_definition and references start from a symbol in the file
  const symbol = getStringArg(args, "symbol");
  const line =
    args?.line === undefined || args?.line === null || args?.line === ""
      ? undefined
      : getNumberArg(args, "line");
  const contents = await ide.readFile(file.uri);
  const position = locateSymbol(contents, symbol, line);
  if (!position) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      `"${symbol}" does not appear in ${file.displayPath}${line ? ` near line ${line}` : ""}. Give a name that is written in that file.`,
    );
  }
  const location = { filepath: file.uri, position };

  if (operation === "references") {
    const refs = await ide.getReferences(location);
    return item(
      `References: ${symbol}`,
      await formatReferences(symbol, refs, dirs, read),
    );
  }

  const found =
    operation === "definition"
      ? await ide.gotoDefinition(location)
      : await ide.gotoTypeDefinition(location);
  const label = operation === "definition" ? "Definition" : "Type definition";
  if (found.length === 0) {
    return item(
      `${label}: ${symbol}`,
      `No ${label.toLowerCase()} found for ${symbol} at ${file.displayPath}:${position.line + 1}. The language server may not know this symbol (a built-in, or a dynamic name); try grep_search.`,
    );
  }
  return item(
    `${label}: ${symbol}`,
    await formatLocations(`${label} of ${symbol}`, found, dirs, read),
  );
};
