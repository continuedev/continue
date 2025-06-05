/**
 * Extracts and processes command strings, handling comments and line continuations.
 * @param cmd The command string to process
 * @returns The processed command string
 */
export function extractCommand(cmd: string): string {
  if (!cmd || cmd.trim() === "") {
    return "";
  }

  // Remove multi-line comments (/* ... */) and replace with a single space
  cmd = cmd.replace(/\/\*[\s\S]*?\*\//g, " ");

  // Handle the $ prompt case first
  if (cmd.includes("$")) {
    const match = cmd.match(/\$\s*([^\n]+)/);
    if (match) {
      // Return just the command after $ without further processing
      return match[1].trim();
    }
  }

  // Process lines - remove single-line comments only at beginning of lines
  const lines = cmd
    .split("\n")
    .map((line) => line.replace(/^\s*#.*$/, "").replace(/^\s*\/\/.*$/, ""))
    .map((line) => line.trim())
    .filter((line) => line);

  // Join lines with proper handling of continuations
  let result = "";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove trailing continuation characters and join with next line
    while (
      (line.endsWith("&&") || line.endsWith("|") || line.endsWith("\\")) &&
      i < lines.length - 1
    ) {
      // Remove the continuation character(s) and any trailing spaces
      line = line.replace(/(&&|\||\\)\s*$/, "").trim();
      // Join with the next line
      i++;
      line += " " + lines[i];
    }

    result += line + " ";
  }

  return result.trim().replace(/\s+/g, " ");
}
