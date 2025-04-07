import { AssistantUnrolled } from "@continuedev/config-yaml";
import { ContinueHubClient } from "@continuedev/hub";
import chalk from "chalk";
import * as fs from "fs";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { handleSlashCommands } from "./slashCommands.js";
import {
  getLlmFromAssistant,
  streamChatResponse,
} from "./streamChatResponse.js";
import { tools } from "./tools.js";

const hub = new ContinueHubClient({
  apiKey: process.env.CONTINUE_API_KEY,
  currentUserSlug: "e2e",
  orgScopeId: null,
  apiBase: process.env.CONTINUE_API_BASE ?? "http://localhost:3001/",
});

async function loadAssistant(): Promise<AssistantUnrolled> {
  const filepathOrSlug = process.argv[2];
  if (!filepathOrSlug) {
    console.error(
      chalk.red(
        "Error: filepath or slug not provided as a command-line argument.",
      ),
    );
    process.exit(1);
  }

  if (!fs.existsSync(filepathOrSlug)) {
    // Assume it's a slug
    return await hub.loadAssistant(filepathOrSlug);
  }

  const content = fs.readFileSync(filepathOrSlug, "utf-8");
  const assistant = await hub.loadAssistantFromContent(content);
  return assistant;
}

function loadSystemMessage(assistant: AssistantUnrolled): string | undefined {
  return assistant.rules
    ?.filter((rule) => !!rule)
    .map((rule) => (typeof rule === "string" ? rule : rule.rule))
    .join("\n");
}

function introMessage(assistant: AssistantUnrolled) {
  console.log(chalk.cyan(CONTINUE_ASCII_ART));

  const { model } = getLlmFromAssistant(assistant);
  console.log(`\n${chalk.bold.blue(`Assistant: ${assistant.name}`)}`);
  console.log(`${chalk.blue(`Model: ${model}`)}\n`);

  console.log(chalk.yellow("Available tools:"));
  tools.forEach((tool) => {
    console.log(`- ${chalk.green(tool.name)}: ${tool.description}`);
  });

  console.log(chalk.yellow("\nAvailable slash commands:"));
  console.log("- /exit: Exit the chat");
  console.log("- /clear: Clear the chat history");
  console.log("- /help: Show help message");
  console.log("- /models: Show available models");
  for (const prompt of assistant.prompts ?? []) {
    console.log(`- /${prompt.name}: ${prompt.description}`);
  }

  if (assistant.rules?.length) {
    console.log(chalk.yellow("\nAssistant rules: " + assistant.rules.length));
  }
  console.log("");
}

async function chat() {
  // Load assistant
  const assistant = await loadAssistant();
  introMessage(assistant);

  // Rules
  const chatHistory: ChatCompletionMessageParam[] = [];
  const systemMessage = loadSystemMessage(assistant);
  if (systemMessage) {
    chatHistory.push({ role: "system", content: systemMessage });
  }

  while (true) {
    // Get user input
    let userInput = readlineSync.question(`\n${chalk.bold.green("You:")} `);

    // Handle slash commands
    const commandResult = handleSlashCommands(userInput, assistant);
    if (commandResult) {
      if (commandResult.exit) {
        break;
      }

      console.log(`\n${chalk.italic.gray(commandResult.output ?? "")}`);

      if (commandResult.newInput) {
        userInput = commandResult.newInput;
      } else {
        continue;
      }
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: userInput });

    // Get AI response with potential tool usage
    console.log(`\n${chalk.bold.blue("Assistant:")}`);

    try {
      await streamChatResponse(chatHistory, assistant);
    } catch (e: any) {
      console.error(`\n${chalk.red(`Error: ${e.message}`)}`);
      console.log(
        chalk.dim(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`),
      );
    }
  }
}

chat().catch((error) =>
  console.error(chalk.red(`Fatal error: ${error.message}`)),
);
