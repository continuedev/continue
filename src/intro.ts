import { AssistantUnrolled } from "@continuedev/config-yaml";
import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
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

export function introMessage(
  config: AssistantUnrolled,
  modelName: string,
  mcpService: MCPService
) {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];

  console.info(`\n${chalk.bold.blue(`Agent: ${config.name}\n`)}`);
  console.info(`${chalk.yellow("Model:")} ${modelName.split("/").pop()}\n`);

  console.info(chalk.yellow("Tools:"));
  BUILTIN_TOOLS.forEach((tool) => {
    console.info(
      `- ${chalk.green(tool.displayName)}: ${tool.description ?? ""}`
    );
  });
  console.info("");

  console.info(chalk.yellow("Slash commands:"));
  console.info(`- ${chalk.green("/exit")}: Exit the chat`);
  console.info(`- ${chalk.green("/clear")}: Clear the chat history`);
  console.info(`- ${chalk.green("/help")}: Show help message`);
  console.info(`- ${chalk.green("/login")}: Authenticate with your account`);
  console.info(`- ${chalk.green("/logout")}: Sign out of your current session`);
  console.info(
    `- ${chalk.green("/whoami")}: Check who you're currently logged in as`
  );
  console.info(`- ${chalk.green("/org")}: Switch organization`);
  console.info(`- ${chalk.green("/config")}: Switch configuration`);
  for (const prompt of config.prompts ?? []) {
    console.info(`- /${prompt?.name}: ${prompt?.description}`);
  }
  for (const prompt of mcpPrompts) {
    console.info(`- /${prompt.name}: ${prompt.description}`);
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
