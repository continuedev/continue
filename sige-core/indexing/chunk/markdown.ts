import { ChunkWithoutID } from "../../";
import { countTokens } from "../../llm/countTokens";

import { basicChunker } from "./basic";

export function cleanFragment(
  fragment: string | undefined,
): string | undefined {
  if (!fragment) {
    return undefined;
  }

  // Remove leading and trailing whitespaces
  fragment = fragment.trim();

  // If there's a ](, which would mean a link, remove everything after it
  const parenIndex = fragment.indexOf("](");
  if (parenIndex !== -1) {
    fragment = fragment.slice(0, parenIndex);
  }

  // Remove all special characters except alphanumeric, hyphen, space, and underscore
  fragment = fragment.replace(/[^\w-\s]/g, "").trim();

  // Convert to lowercase
  fragment = fragment.toLowerCase();

  // Replace spaces with hyphens
  fragment = fragment.replace(/\s+/g, "-");

  return fragment;
}

export function cleanHeader(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  // Remove leading and trailing whitespaces
  header = header.trim();

  // If there's a (, remove everything after it
  const parenIndex = header.indexOf("(");
  if (parenIndex !== -1) {
    header = header.slice(0, parenIndex);
  }

  // Remove all special characters except alphanumeric, hyphen, space, and underscore
  header = header
    .replace(/[^\w-\s]/g, "")
    .replace("¶", "")
    .trim();

  return header;
}

function findHeader(lines: string[]): string | undefined {
  return lines.find((line) => line.startsWith("#"))?.split("# ")[1];
}

export async function* markdownChunker(
  content: string,
  maxChunkSize: number,
  hLevel: number,
): AsyncGenerator<ChunkWithoutID> {
  if (countTokens(content) <= maxChunkSize) {
    const header = findHeader(content.split("\n"));
    yield {
      content,
      startLine: 0,
      endLine: content.split("\n").length,
      otherMetadata: {
        fragment: cleanFragment(header),
        title: cleanHeader(header),
      },
    };
    return;
  }
  if (hLevel > 4) {
    const header = findHeader(content.split("\n"));

    for await (const chunk of basicChunker(content, maxChunkSize)) {
      yield {
        ...chunk,
        otherMetadata: {
          fragment: cleanFragment(header),
          title: cleanHeader(header),
        },
      };
    }
    return;
  }

  const h = `${"#".repeat(hLevel + 1)} `;
  const lines = content.split("\n");
  const sections = [];

  let currentSectionStartLine = 0;
  let currentSection: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(h) || i === 0) {
      if (currentSection.length) {
        const isHeader = currentSection[0].startsWith(h);
        sections.push({
          header: isHeader ? currentSection[0] : findHeader(currentSection),
          content: currentSection.slice(isHeader ? 1 : 0).join("\n"),
          startLine: currentSectionStartLine,
          endLine: currentSectionStartLine + currentSection.length,
        });
      }
      currentSection = [lines[i]];
      currentSectionStartLine = i;
    } else {
      currentSection.push(lines[i]);
    }
  }

  if (currentSection.length) {
    const isHeader = currentSection[0].startsWith(h);
    sections.push({
      header: isHeader ? currentSection[0] : findHeader(currentSection),
      content: currentSection.slice(isHeader ? 1 : 0).join("\n"),
      startLine: currentSectionStartLine,
      endLine: currentSectionStartLine + currentSection.length,
    });
  }

  for (const section of sections) {
    for await (const chunk of markdownChunker(
      section.content,
      maxChunkSize - (section.header ? countTokens(section.header) : 0),
      hLevel + 1,
    )) {
      yield {
        content: `${section.header}\n${chunk.content}`,
        startLine: section.startLine + chunk.startLine,
        endLine: section.startLine + chunk.endLine,
        otherMetadata: {
          fragment:
            chunk.otherMetadata?.fragment || cleanFragment(section.header),
          title: chunk.otherMetadata?.title || cleanHeader(section.header),
        },
      };
    }
  }
}

/**
 * Recursively chunks by header level (h1-h6)
 * The final chunk will always include all parent headers
 * TODO: Merge together neighboring chunks if their sum doesn't exceed maxChunkSize
 */
