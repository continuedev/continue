export function closeTag(openingTag: string): string {
  return `</${openingTag.slice(1)}`;
}

export function getStringDelta(original: string, updated: string): string {
  if (!updated.startsWith(original)) {
    console.warn(
      `Original string "${original}" is not a prefix of updated string "${updated}"`,
    );
    return updated;
  }
  return updated.slice(original.length);
}

export function splitAtTagsAndCodeblocks(content: string) {
  if (!content) return [""];

  // Add spaces after > and before < to help with splitting
  const BOUNDARY = "XML_PARSING_BOUNDARY_9b1deb4d3b7d"; // not that important, just something unique
  const spaced = content
    .replace(/\`\`\`/g, `${BOUNDARY}\`\`\`${BOUNDARY}`)
    .replace(/>/g, `>${BOUNDARY}`)
    .replace(/</g, `${BOUNDARY}<`);

  // Split on spaces and filter out empty strings
  const parts = spaced.split(BOUNDARY).filter(Boolean);

  return parts;
}
