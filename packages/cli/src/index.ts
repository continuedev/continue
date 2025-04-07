import * as dotenv from "dotenv";
import { OpenAI } from "openai";
import * as readlineSync from "readline-sync";
import { CONTINUE_ASCII_ART } from "./asciiArt.js";

dotenv.config();
const openai = new OpenAI();

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const chatHistory: ChatMessage[] = [
  {
    role: "system",
    content:
      "You are a helpful AI assistant. Be concise and clear in your responses.",
  },
];

// Define a function to handle streaming responses
async function streamChatResponse(userInput: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Create a stream for the AI response
  const stream = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: chatHistory,
    max_tokens: 1000,
    temperature: 0.7,
    stream: true, // Enable streaming
  });

  let aiResponse = "";

  // Iterate over the stream and display the response in real-time
  for await (const chunk of stream) {
    const content = chunk.choices[0].delta.content;
    if (content) {
      process.stdout.write(content); // Write to stdout without a newline
      aiResponse += content;
    }
  }

  console.log(); // Add a newline at the end of the response
  return aiResponse;
}

function handleSlashCommands(input: string): string | null {
  if (input.startsWith("/")) {
    const [command, ...args] = input.split(" ");
    switch (command) {
      case "/help":
        return "Available commands:\n/help - Show this help message\n/exit - Exit the chat";
      case "/exit":
        return "exit";
      default:
        return `Unknown command: ${command}`;
    }
  }
  return null;
}

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
      const aiResponse = await streamChatResponse(userInput);

      // Add AI response to history
      chatHistory.push({ role: "assistant", content: aiResponse });

      // Display AI response (already displayed in real-time)
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      chatHistory.pop(); // Remove the failed message from history
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
