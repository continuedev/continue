/**
 * It's helpful to know what functions errors occur in, but absolute
 * file paths are sensitive information, so we want to remove them.
 * @param stack The stack trace to extract minimal information from.
 * @returns A string containing the minimal stack trace information.
 */
export function extractMinimalStackTraceInfo(stack: unknown): string {
  if (typeof stack !== "string") {
    return "";
  }
  const lines = stack
    .trim()
    .split("\n")
    .map((line) => line.trim());
  const minimalLines = lines.filter((line) => {
    return (
      line.startsWith("at ") &&
      !line.includes("node_modules") &&
      !line.includes("node:internal")
    );
  });
  return minimalLines
    .map((line) => line.replace("at ", "").split(" (").slice(0, 1))
    .flatMap((parts) =>
      parts.map(
        // to be safe, remove any lingering paths - anonymous function case
        (part) =>
          part.replace(/(?:[A-Za-z]:[\\/]|[\\/])[^\n]*?:\d+:\d+/g, "").trim(),
      ),
    )
    .filter((part) => !!part) // remove empty string parts (anonymous functions case)
    .join(", ");
}
