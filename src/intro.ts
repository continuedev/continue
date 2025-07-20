import { AssistantUnrolled } from "@continuedev/config-yaml";
import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
import { getAllSlashCommands } from "./commands/commands.js";
import { MCPService } from "./mcp.js";
import { BUILTIN_TOOLS } from "./tools/index.js";

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
  modelName: string,
  mcpService: MCPService
) {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  // Get all slash commands from central definition
  const allCommands = getAllSlashCommands(config);

  console.info(`\n${chalk.bold.yellow(`Agent: ${config.name}\n`)}`);
  console.info(`${chalk.blue("Model:")} ${modelName.split("/").pop()}\n`);

  console.info(chalk.blue("Tools:"));
  BUILTIN_TOOLS.forEach((tool) => {
    console.info(
      `- ${chalk.white(tool.displayName)}: ${chalk.dim(tool.description ?? "")}`
    );
  });
  console.info("");

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

  // if (config.rules?.length) {
  //   console.info(chalk.yellow("\nRules: " + config.rules.length));
  // }

  if (config.mcpServers?.length) {
    console.info(chalk.yellow("MCP Servers:"));
    config.mcpServers.forEach((server: any) => {
      console.info(`- ${chalk.cyan(server?.name)}`);
    });
  }
  console.info("");
}
