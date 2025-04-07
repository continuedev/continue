import { AssistantUnrolled } from "@continuedev/config-yaml";
import { ContinueHubClient } from "@continuedev/hub";
import * as fs from "fs";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";
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
      "Error: filepath or slug not provided as a command-line argument.",
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
  console.log(CONTINUE_ASCII_ART);

  console.log(`\nAssistant: ${assistant.name}\n`);
  console.log("Available tools:");
  tools.forEach((tool) => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
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
    let userInput = readlineSync.question("\nYou: ");

    // Handle slash commands
    const commandResult = handleSlashCommands(userInput, assistant);
    if (commandResult) {
      if (commandResult.exit) {
        break;
      }

      console.log(`\n${commandResult.output ?? ""}`);

      if (commandResult.newInput) {
        userInput = commandResult.newInput;
      } else {
        continue;
      }
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: userInput });

    // Get AI response with potential tool usage
    console.log("\nAssistant:");

    try {
      await streamChatResponse(chatHistory, assistant);
    } catch (e: any) {
      console.error(`\nError: ${e.message}`);
      console.log(`Chat history:\n${JSON.stringify(chatHistory, null, 2)}`);
    }
  }
}

chat().catch(console.error);
