/**
 * Extracts and processes command strings, handling comments and line continuations.
 * @param cmd The command string to process
 * @returns The processed command string
 */
export function extractCommand(cmd: string): string {
  if (!cmd || cmd.trim() === "") {
    return "";
  }

  // Remove multi-line comments (/* ... */) and replace with a single space, handling surrounding usage
  cmd = cmd.replace(/[ \t]*\/\*[\s\S]*?\*\/[ \t]*/g, " ");

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
    .map((line) => line.replace(/^\s*#.*$/, "").replace(/^\s*\/\/.*$/, "")) // Remove comments
    .map((line) => line.trim())
    .filter((line) => line);

  // Join lines, respecting backslash continuations logic
  let result = "";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line continuation with backslash
    if (line.endsWith("\\") && i < lines.length - 1) {
      // Remove the backslash and join with next line using a space
      result += line.slice(0, -1).trim() + " ";
    } else {
      // Otherwise keep the line and add a newline
      result += line;
      if (i < lines.length - 1) {
        result += "\n";
      }
    }
  }

  return result.trim();
}
