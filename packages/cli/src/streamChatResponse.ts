import { AssistantUnrolled } from "@continuedev/config-yaml";
import { constructLlmApi } from "@continuedev/openai-adapters";
import * as dotenv from "dotenv";
import { ChatMessage } from "./types.js";

dotenv.config();

function getLlmFromAssistant(assistant: AssistantUnrolled) {
  const chatModel = assistant.models?.filter((model) =>
    model?.roles?.includes("chat"),
  )?.[0];
  if (!chatModel) {
    console.error("Error: No chat model found in the assistant.");
    process.exit(1);
  }
  const llm = constructLlmApi({
    provider: chatModel.provider as any,
    apiKey: chatModel.apiKey,
    apiBase: chatModel.apiBase,
  });
  if (!llm) {
    console.error("Error: Failed to construct LLM API.");
    process.exit(1);
  }

  return { llm, model: chatModel.model };
}

// Define a function to handle streaming responses
export async function streamChatResponse(
  chatHistory: ChatMessage[],
  assistant: AssistantUnrolled,
) {
  const { llm, model } = getLlmFromAssistant(assistant);

  const stream = llm.chatCompletionStream(
    {
      model,
      messages: chatHistory,
      stream: true,
    },
    new AbortController().signal,
  );

  let aiResponse = "";

  // // Iterate over the stream and display the response in real-time
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
