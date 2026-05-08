import type { MemoryHeader } from "./types.js";

export function formatMemoryManifest(
  memories: readonly MemoryHeader[],
): string {
  return memories
    .map((memory) => {
      const parts = [];
      if (memory.type) {
        parts.push(`[${memory.type}]`);
      }
      parts.push(memory.filename);
      parts.push(`(${new Date(memory.mtimeMs).toISOString()})`);

      const prefix = parts.join(" ");
      return memory.description
        ? `- ${prefix}: ${memory.description}`
        : `- ${prefix}`;
    })
    .join("\n");
}
