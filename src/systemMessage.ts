import { execSync } from "child_process";
import * as fs from "fs";
import pkg from "ignore-walk";
import { Minimatch } from "minimatch";
import * as path from "path";
import { processRule } from "./args.js";
const { WalkerSync } = pkg;

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
    const walker = new WalkerSync({
      path: process.cwd(),
      includeEmpty: false,
      follow: false,
      ignoreFiles: [".gitignore", ".continueignore", ".customignore"],
    });

    (walker.ignoreRules as any)[".customignore"] = [
      new Minimatch(".git/*", {
        matchBase: true,
        dot: true,
        flipNegate: true,
        nocase: true,
      }),
    ];

    const files = walker.start().result as string[];

    const filteredFiles = files
      .slice(0, 100)
      .map((file: string) => `./${file}`);

    return filteredFiles.join("\n") || "No structure available";
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
1. IMPORTANT: You should be concise, direct, and to the point, since your responses will be displayed on a command line interface.
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
 * @param additionalRules - Additional rules from --rule flags
 * @param format - Output format for headless mode
 * @returns The comprehensive system message with base message and rules section
 */
export async function constructSystemMessage(
  rulesSystemMessage: string,
  additionalRules?: string[],
  format?: "json"
): Promise<string> {
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

  // Process additional rules from --rule flags
  let processedRules: string[] = [];
  if (additionalRules && additionalRules.length > 0) {
    for (const ruleSpec of additionalRules) {
      try {
        const processedRule = await processRule(ruleSpec);
        processedRules.push(processedRule);
      } catch (error: any) {
        console.warn(
          `Warning: Failed to process rule "${ruleSpec}": ${error.message}`
        );
      }
    }
  }

  // Construct the comprehensive system message
  let systemMessage = baseSystemMessage;

  // Add JSON formatting instructions if format is json
  if (format === "json") {
    systemMessage += `

IMPORTANT: You are operating in JSON output mode. Your final response MUST be valid JSON that can be parsed by JSON.parse(). The JSON should contain properties relevant to answer the user's question. You don't need to include any general "response" or "answer" field. Do not include any text before or after the JSON - the entire response must be parseable JSON.

Example response format:
{
  "property": "value"
}`;
  }

  // Add rules section if we have any rules or agent content
  if (rulesSystemMessage || agentContent || processedRules.length > 0) {
    systemMessage += '\n\n<context name="userRules">';

    if (rulesSystemMessage) {
      systemMessage += `\n${rulesSystemMessage}`;
    }

    if (agentContent) {
      const separator = rulesSystemMessage ? "\n\n" : "\n";
      systemMessage += `${separator}${agentContent}`;
    }

    // Add processed rules from --rule flags
    if (processedRules.length > 0) {
      const separator = rulesSystemMessage || agentContent ? "\n\n" : "\n";
      systemMessage += `${separator}${processedRules.join("\n\n")}`;
    }

    systemMessage += "\n</context>";
  }

  return systemMessage;
}
