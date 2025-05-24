export function getStringDelta(original: string, updated: string): string {
  if (!updated.startsWith(original)) {
    console.warn(
      `Original string "${original}" is not a prefix of updated string "${updated}"`,
    );
    return updated;
  }
  return updated.slice(original.length);
}
