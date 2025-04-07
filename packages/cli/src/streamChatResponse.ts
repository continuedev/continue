import * as dotenv from "dotenv";
import OpenAI from "openai";
import { ChatMessage } from "./types.js";

dotenv.config();
const openai = new OpenAI();

// Define a function to handle streaming responses
export async function streamChatResponse(chatHistory: ChatMessage[]) {
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
