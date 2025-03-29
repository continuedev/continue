import * as dotenv from "dotenv";
import { OpenAI } from "openai";
import * as readlineSync from "readline-sync";

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat history to maintain context
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

async function chat() {
  console.log('Welcome to the AI Chat CLI! (Type "exit" to quit)\n');

  while (true) {
    // Get user input
    const userInput = readlineSync.question("\nYou: ");

    // Check for exit command
    if (userInput.toLowerCase() === "exit") {
      console.log("\nGoodbye!");
      break;
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: userInput });

    try {
      // Get AI response
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: chatHistory,
        max_tokens: 1000,
        temperature: 0.7,
      });

      // Get the AI's response
      const aiResponse = completion.choices[0].message.content;

      // Add AI response to history
      chatHistory.push({ role: "assistant", content: aiResponse || "" });

      // Display AI response
      console.log("\nAI:", aiResponse);
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
