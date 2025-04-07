import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";
import { handleSlashCommands } from "./slashCommands.js";
import { streamChatResponse } from "./streamChatResponse.js";
import { ChatMessage } from "./types.js";

const chatHistory: ChatMessage[] = [
  {
    role: "system",
    content:
      "You are a helpful AI assistant. Be concise and clear in your responses.",
  },
];

async function chat() {
  console.log(CONTINUE_ASCII_ART);

  while (true) {
    // Get user input
    const userInput = readlineSync.question("\nYou: ");

    // Handle slash commands
    const commandResult = handleSlashCommands(userInput);
    if (commandResult) {
      if (commandResult === "exit") {
        console.log("\nGoodbye!");
        break;
      }
      console.log(`\n${commandResult}`);
      continue;
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: userInput });

    try {
      // Get AI response
      const aiResponse = await streamChatResponse(chatHistory);

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
