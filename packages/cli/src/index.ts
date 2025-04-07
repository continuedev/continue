import { AssistantUnrolled } from "@continuedev/config-yaml";
import { ContinueHubClient } from "@continuedev/hub";
import * as fs from "fs";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";
import { ChatMessage } from "./types.js";

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

async function chat() {
  // Load assistant
  const assistant = await loadAssistant();

  // Rules
  const chatHistory: ChatMessage[] = [];
  const systemMessage = loadSystemMessage(assistant);
  if (systemMessage) {
    chatHistory.push({ role: "system", content: systemMessage });
  }

  console.log(CONTINUE_ASCII_ART);

  console.log(`\nAssistant: ${assistant.name}\n`);

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

    try {
      // Get AI response
      const aiResponse = await streamChatResponse(chatHistory, assistant);

      // Add AI response to history
      chatHistory.push({ role: "assistant", content: aiResponse });

      // Display AI response (already displayed in real-time)
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      chatHistory.pop(); // Remove the failed user message from history
    }
  }
}

// Start the chat if this file is run directly
// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY not found in environment variables");
  console.error("Please create a .env file with your OpenAI API key");
  process.exit(1);
}

chat().catch(console.error);
