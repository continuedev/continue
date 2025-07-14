import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Check if current directory is a git repository
 */
function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get basic directory structure
 */
function getDirectoryStructure(): string {
  try {
    const result = execSync(
      'find . -type f -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.md" | head -20',
      {
        encoding: "utf-8",
        cwd: process.cwd(),
      }
    );
    return result.trim() || "No structure available";
  } catch {
    return "Directory structure not available";
  }
}

/**
 * Get git status
 */
function getGitStatus(): string {
  try {
    if (!isGitRepo()) {
      return "Not a git repository";
    }
    const result = execSync("git status --porcelain", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    return result.trim() || "Working tree clean";
  } catch {
    return "Git status not available";
  }
}

const baseSystemMessage = `You are an agent in the Continue CLI. Given the user's prompt, you should use the tools available to you to answer the user's question.

Notes:
1. IMPORTANT: You should be concise, direct, and to the point, since your responses will be displayed on a command line interface. Answer the user's question directly, without elaboration, explanation, or details. One word answers are best. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>.", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...".
2. When relevant, share file names and code snippets relevant to the query
3. Any file paths you return in your final response MUST be absolute. DO NOT use relative paths.
Here is useful information about the environment you are running in:
<env>
Working directory: ${process.cwd()}
Is directory a git repo: ${isGitRepo()}
Platform: ${process.platform}
Today's date: ${new Date().toISOString().split("T")[0]}
</env>

As you answer the user's questions, you can use the following context:

<context name="directoryStructure">Below is a snapshot of this project's file structure at the start of the conversation. This snapshot will NOT update during the conversation. It skips over .gitignore patterns.

${getDirectoryStructure()}
</context>
<context name="gitStatus">This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.
${getGitStatus()}
</context>`;

/**
 * Load and construct a comprehensive system message with base message and rules section
 * @param rulesSystemMessage - The rules system message from the assistant
 * @returns The comprehensive system message with base message and rules section
 */
export function constructSystemMessage(rulesSystemMessage: string): string {
  const agentFiles = ["AGENTS.md", "AGENT.md", "CLAUDE.md", "CODEX.md"];

  let agentContent = "";

  try {
    for (const fileName of agentFiles) {
      const filePath = path.join(process.cwd(), fileName);

      if (fs.existsSync(filePath)) {
        agentContent = fs.readFileSync(filePath, "utf-8");
        break; // Use the first found agent file
      }
    }
  } catch (error) {
    // If there's any error reading the file, continue without agent content
    console.warn("Warning: Could not read agent configuration file:", error);
  }

  // Construct the comprehensive system message
  let systemMessage = baseSystemMessage;

  // Add rules section if we have either rules or agent content
  if (rulesSystemMessage || agentContent) {
    systemMessage += '\n\n<context name="userRules">';

    if (rulesSystemMessage) {
      systemMessage += `\n${rulesSystemMessage}`;
    }

    if (agentContent) {
      const separator = rulesSystemMessage ? "\n\n" : "\n";
      systemMessage += `${separator}${agentContent}`;
    }

    systemMessage += "\n</context>";
  }

  console.log("SYS: ", systemMessage);
  return systemMessage;
}
