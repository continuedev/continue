import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import pkg from "ignore-walk";
import { Minimatch } from "minimatch";

import { processRule } from "./hubLoader.js";
import { PermissionMode } from "./permissions/types.js";
import { serviceContainer } from "./services/ServiceContainer.js";
import { ConfigServiceState, SERVICE_NAMES } from "./services/types.js";
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
      .slice(0, 500)
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

async function getConfigYamlRules(): Promise<string[]> {
  const configState = await serviceContainer.get<ConfigServiceState>(
    SERVICE_NAMES.CONFIG,
  );
  if (configState.config?.rules) {
    // Extract systemMessage from the config if it exists
    const rules = configState.config.rules;
    return rules
      .map((rule) => {
        return typeof rule === "string" ? rule : rule?.rule;
      })
      .filter((rule): rule is string => !!rule);
  }

  return [];
}

/**
 * Load and construct a comprehensive system message with base message and rules section
 * @param additionalRules - Additional rules from --rule flags
 * @param format - Output format for headless mode
 * @param headless - Whether running in headless mode
 * @param mode - Current permission mode
 * @returns The comprehensive system message with base message and rules section
 */
export async function constructSystemMessage(
  mode: PermissionMode,
  additionalRules?: string[],
  format?: "json",
  headless?: boolean,
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
  const processedRules: string[] = [];
  if (additionalRules && additionalRules.length > 0) {
    for (const ruleSpec of additionalRules) {
      try {
        const processedRule = await processRule(ruleSpec);
        processedRules.push(processedRule);
      } catch (error: any) {
        console.warn(
          `Warning: Failed to process rule "${ruleSpec}": ${error.message}`,
        );
      }
    }
  }

  const configYamlRules = await getConfigYamlRules();
  processedRules.push(...configYamlRules);

  // Construct the comprehensive system message
  let systemMessage = baseSystemMessage;

  // Add plan mode specific instructions if in plan mode
  if (mode === "plan") {
    systemMessage +=
      '\n<context name="planMode">You are operating in _Plan Mode_, which means that your goal is to help the user investigate their ideas and develop a plan before taking action. You only have access to read-only tools and should not attempt to circumvent them to write / delete / create files. Ask the user to switch to agent mode if they want to make changes. For example, it is not acceptable to use the Bash tool to write to files.</context>\n';
  } else {
    // Check if commit signature is disabled via environment variable
    if (!process.env.CONTINUE_CLI_DISABLE_COMMIT_SIGNATURE) {
      systemMessage += `\n<context name="commitSignature">When creating commits using any CLI or tool, include the following in the commit message:
Generated with [Continue](https://continue.dev)

Co-Authored-By: Continue <noreply@continue.dev>
</context>\n`;
    }
  }

  // In headless mode, add instructions to be concise and only provide final answers
  if (headless) {
    systemMessage += `

IMPORTANT: You are running in headless mode. Provide ONLY your final answer to the user's question. Do not include explanations, reasoning, or additional commentary unless specifically requested. Be direct and concise.`;
  }

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
  if (agentContent || processedRules.length > 0) {
    systemMessage += '\n\n<context name="userRules">';

    if (agentContent) {
      systemMessage += `\n${agentContent}`;
    }

    // Add processed rules from --rule flags
    if (processedRules.length > 0) {
      const separator = agentContent ? "\n\n" : "\n";
      systemMessage += `${separator}${processedRules.join("\n\n")}`;
    }

    systemMessage += "\n</context>";
  }

  return systemMessage;
}
