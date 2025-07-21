import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "./args.js";
import { getAllSlashCommands } from "./commands/commands.js";
import { MCPService } from "./mcp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const packagePath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version;
  } catch (error) {
    return "unknown";
  }
}

export function loadSystemMessage(
  assistant: AssistantConfig
): string | undefined {
  return assistant.rules
    ?.filter((rule) => !!rule)
    .map((rule) => (typeof rule === "string" ? rule : rule?.rule))
    .join("\n");
}

export async function introMessage(
  config: AssistantUnrolled,
  model: ModelConfig,
  mcpService: MCPService
) {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  // Get all slash commands from central definition
  const allCommands = getAllSlashCommands(config);

  console.info(`\n${chalk.bold.yellow(`Agent: ${config.name}\n`)}`);
  console.info(`${chalk.blue("Model:")} ${model.name.split("/").pop()}\n`);

  // console.info(chalk.blue("Tools:"));
  // BUILTIN_TOOLS.forEach((tool) => {
  //   console.info(
  //     `- ${chalk.white(tool.displayName)}: ${chalk.dim(tool.description ?? "")}`
  //   );
  // });
  // console.info("");

  console.info(chalk.blue("Slash commands:"));

  // Display all commands from central definition
  for (const command of allCommands) {
    console.info(
      `- ${chalk.white("/" + command.name)}: ${chalk.dim(command.description)}`
    );
  }

  // Display MCP prompts separately since they're not part of our central definition
  for (const prompt of mcpPrompts) {
    console.info(
      `- ${chalk.white("/" + prompt.name)}: ${chalk.dim(prompt.description)}`
    );
  }
  console.info("");

  // Show all rules in a single section
  const args = parseArgs();
  const commandLineRules = args.rules || [];
  const configRules = config.rules?.map((rule: any) => 
    typeof rule === "string" ? rule : rule?.name || "Unknown"
  ) || [];
  
  const allRules = [...commandLineRules, ...configRules];
  
  if (allRules.length > 0) {
    console.info(chalk.blue("Rules:"));
    allRules.forEach((rule) => {
      console.info(`- ${chalk.white(rule)}`);
    });
    console.info("");
  }

  if (config.mcpServers?.length) {
    console.info(chalk.blue("MCP Servers:"));
    config.mcpServers.forEach((server: any) => {
      console.info(`- ${chalk.white(server?.name)}`);
    });
    console.info("");
  }
}