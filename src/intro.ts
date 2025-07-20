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
  console.info(`- ${chalk.white("/exit")}: ${chalk.dim("Exit the chat")}`);
  console.info(
    `- ${chalk.white("/clear")}: ${chalk.dim("Clear the chat history")}`
  );
  console.info(`- ${chalk.white("/help")}: ${chalk.dim("Show help message")}`);
  console.info(
    `- ${chalk.white("/login")}: ${chalk.dim("Authenticate with your account")}`
  );
  console.info(
    `- ${chalk.white("/logout")}: ${chalk.dim(
      "Sign out of your current session"
    )}`
  );
  console.info(
    `- ${chalk.white("/whoami")}: ${chalk.dim(
      "Check who you're currently logged in as"
    )}`
  );
  console.info(`- ${chalk.white("/org")}: ${chalk.dim("Switch organization")}`);
  console.info(
    `- ${chalk.white("/config")}: ${chalk.dim("Switch configuration")}`
  );
  for (const prompt of config.prompts ?? []) {
    console.info(
      `- ${chalk.white("/" + prompt?.name)}: ${chalk.dim(prompt?.description)}`
    );
  }
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
