import { formatMemoryManifest } from "./formatMemoryManifest.js";
import { scanMemoryFiles } from "./memoryScan.js";
import {
  type MemoryHeader,
  type MemorySelection,
  type MemorySelector,
} from "./types.js";

const DEFAULT_MAX_RESULTS = 5;

function scoreMemoryHeader(header: MemoryHeader, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  if (tokens.length === 0) {
    return 0;
  }

  const searchTarget = [
    header.name,
    header.filename,
    header.description ?? "",
    header.type ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const matchCount = tokens.filter((token) =>
    searchTarget.includes(token),
  ).length;
  const recencyBonus =
    1 -
    Math.min(Date.now() - header.mtimeMs, 7 * 24 * 60 * 60 * 1000) /
      (7 * 24 * 60 * 60 * 1000);

  return matchCount / tokens.length + recencyBonus * 0.2;
}

function mapSelectedHeaders(
  headers: readonly MemoryHeader[],
  selectedNames: readonly string[],
): MemorySelection[] {
  const byRelativePath = new Map(
    headers.map((header) => [header.filename, header]),
  );
  const byAbsolutePath = new Map(
    headers.map((header) => [header.filePath, header]),
  );
  const byName = new Map(headers.map((header) => [header.name, header]));

  return selectedNames
    .map((selectedName, index) => {
      const header =
        byRelativePath.get(selectedName) ??
        byAbsolutePath.get(selectedName) ??
        byName.get(selectedName);

      if (!header) {
        return null;
      }

      return {
        ...header,
        score: Math.max(0, 1 - index * 0.1),
      } satisfies MemorySelection;
    })
    .filter((header): header is MemorySelection => header !== null);
}

export async function findRelevantMemories(args: {
  query: string;
  memoryDir: string;
  headers?: readonly MemoryHeader[];
  alreadySurfaced?: ReadonlySet<string>;
  selector?: MemorySelector;
  maxResults?: number;
}): Promise<MemorySelection[]> {
  const {
    query,
    memoryDir,
    headers: providedHeaders,
    alreadySurfaced = new Set<string>(),
    selector,
    maxResults = DEFAULT_MAX_RESULTS,
  } = args;

  const headers = (
    providedHeaders ?? (await scanMemoryFiles(memoryDir))
  ).filter((header) => !alreadySurfaced.has(header.filePath));

  if (headers.length === 0) {
    return [];
  }

  if (selector) {
    const manifest = formatMemoryManifest(headers);
    const selectedNames = await selector({
      query,
      manifest,
      headers,
      maxResults,
    });

    if (selectedNames && selectedNames.length > 0) {
      return mapSelectedHeaders(headers, selectedNames).slice(0, maxResults);
    }
  }

  return headers
    .map((header) => ({
      ...header,
      score: scoreMemoryHeader(header, query),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults);
}
