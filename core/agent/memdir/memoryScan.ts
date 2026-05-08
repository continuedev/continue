import fsPromises from "fs/promises";
import * as path from "path";

import { parseMarkdownRule } from "@yutoagentic/config-yaml";

import type { MemoryHeader } from "./types.js";

const MAX_MEMORY_FILES = 200;
const INCLUDED_EXTENSIONS = new Set([".md", ".txt"]);

async function walkMemoryDir(
  root: string,
  currentDir: string,
  results: MemoryHeader[],
): Promise<void> {
  const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkMemoryDir(root, filePath, results);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(ext) || entry.name === "MEMORY.md") {
      continue;
    }

    try {
      const [stat, rawContent] = await Promise.all([
        fsPromises.stat(filePath),
        fsPromises.readFile(filePath, "utf8"),
      ]);
      const { frontmatter } = parseMarkdownRule(rawContent);
      const relativePath = path
        .relative(root, filePath)
        .split(path.sep)
        .join("/");

      results.push({
        filename: relativePath,
        filePath,
        name:
          typeof frontmatter.name === "string" &&
          frontmatter.name.trim().length > 0
            ? frontmatter.name.trim()
            : relativePath.replace(/\.(md|txt)$/i, ""),
        mtimeMs: stat.mtimeMs,
        description:
          typeof frontmatter.description === "string" &&
          frontmatter.description.trim().length > 0
            ? frontmatter.description.trim()
            : null,
        type:
          typeof (frontmatter as { type?: unknown }).type === "string" &&
          (frontmatter as { type?: string }).type?.trim()
            ? (frontmatter as { type?: string }).type!.trim()
            : null,
      });
    } catch {
      // Ignore unreadable memory files so a single bad file does not block recall.
    }
  }
}

export async function scanMemoryFiles(
  memoryDir: string,
): Promise<MemoryHeader[]> {
  const headers: MemoryHeader[] = [];

  try {
    await walkMemoryDir(memoryDir, memoryDir, headers);
  } catch {
    return [];
  }

  return headers
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, MAX_MEMORY_FILES);
}
