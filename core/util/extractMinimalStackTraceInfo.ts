/**
 * It's helpful to know what functions errors occur in, but absolute
 * file paths are sensitive information, so we want to remove them.
 * @param stack The stack trace to extract minimal information from.
 * @returns A string containing the minimal stack trace information.
 */
export function extractMinimalStackTraceInfo(stack: unknown): string {
  if (typeof stack !== "string") {return "";}
  const lines = stack.split("\n");
  const minimalLines = lines.filter((line) => {
    return line.trimStart().startsWith("at ") && !line.includes("node_modules");
  });
  return minimalLines
    .map((line) => line.trimStart().replace("at ", "").split(" (").slice(0, 1))
    .join(", ");
}
