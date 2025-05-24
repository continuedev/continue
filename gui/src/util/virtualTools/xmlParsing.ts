export function splitAtTagBoundaries(content: string) {
  if (!content) return [""];

  // Add spaces after > and before < to help with splitting
  const BOUNDARY = "XML_PARSING_BOUNDARY_9b1deb4d3b7d"; // not that important, just something unique
  const spaced = content
    .replace(/>/g, `>${BOUNDARY}`)
    .replace(/</g, `${BOUNDARY}<`);

  // Split on spaces and filter out empty strings
  const parts = spaced.split(BOUNDARY).filter(Boolean);

  return parts;
}
