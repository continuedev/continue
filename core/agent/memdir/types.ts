export interface MemoryHeader {
  filename: string;
  filePath: string;
  name: string;
  mtimeMs: number;
  description: string | null;
  type: string | null;
}

export interface MemorySelection extends MemoryHeader {
  score: number;
}

export interface MemorySelectorArgs {
  query: string;
  manifest: string;
  headers: readonly MemoryHeader[];
  maxResults: number;
}

export type MemorySelector = (
  args: MemorySelectorArgs,
) => Promise<readonly string[] | null>;
