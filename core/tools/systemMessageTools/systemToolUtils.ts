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

export function splitAtCodeblocksAndNewLines(content: string) {
  if (!content) return [""];

  // Add split markers before and after codeblocks/new lines
  const BOUNDARY = "SPLIT_BOUNDARY_9b1deb4d3b7d"; // not that important, just something unique
  let spaced = content.replaceAll("```", `${BOUNDARY}\`\`\`${BOUNDARY}`);
  spaced = content.replaceAll("\n", `${BOUNDARY}\n${BOUNDARY}`);

  // Split on markers and filter out empty strings
  const parts = spaced.split(BOUNDARY).filter(Boolean);

  return parts;
}
