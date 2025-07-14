import * as fs from "fs";
import * as path from "path";

/**
 * Load and append agent configuration content to the system message if it exists
 * @param baseSystemMessage - The base system message from the assistant
 * @returns The enhanced system message with agent configuration content if available
 */
export function constructSystemMessage(baseSystemMessage: string): string {
  const agentFiles = ["AGENTS.md", "AGENT.md", "CLAUDE.md", "CODEX.md"];

  try {
    for (const fileName of agentFiles) {
      const filePath = path.join(process.cwd(), fileName);

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");

        // Append file content to the base system message
        const separator = baseSystemMessage ? "\n\n" : "";
        return `${baseSystemMessage}${separator}# Repository Context from ${fileName}\n\n${fileContent}`;
      }
    }
  } catch (error) {
    // If there's any error reading the file, just return the base system message
    console.warn("Warning: Could not read agent configuration file:", error);
  }

  return baseSystemMessage;
}
