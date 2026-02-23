import { ILLM, LLMFullCompletionOptions } from "..";

import { removeCodeBlocksAndTrim, removeQuotesAndEscapes } from ".";

import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import type { IMessenger } from "../protocol/messenger";
import { renderChatMessage } from "./messageContent";
import { convertFromUnifiedHistory } from "./messageConversion";

export class ChatDescriber {
  static maxTokens = 16; // Increased from 12 to meet GPT-5 minimum requirement
  static prompt: string | undefined =
    "Given the following... please reply with a title for the chat that is 3-4 words in length, all words used should be directly related to the content of the chat, avoid using verbs unless they are directly related to the content of the chat, no additional text or explanation, you don't need ending punctuation.\n\n";
  static messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

  static async describe(
    model: ILLM,
    completionOptions: LLMFullCompletionOptions,
    message: string,
  ): Promise<string | undefined> {
    if (!ChatDescriber.prompt) {
      return;
    }

    // Clean up and distill the message we want to send to the LLM
    message = removeCodeBlocksAndTrim(message);

    if (!message) {
      return;
    }

    completionOptions.maxTokens = ChatDescriber.maxTokens;

    // Prompt the user's current LLM for the title
    const titleResponse = await model.chat(
      [
        {
          role: "user",
          content: ChatDescriber.prompt + message,
        },
      ],
      new AbortController().signal,
      completionOptions,
    );

    // Set the title
    return removeQuotesAndEscapes(renderChatMessage(titleResponse));
  }

  // CLI-specific method that works with BaseLlmApi
  static async describeWithBaseLlmApi(
    llmApi: any, // BaseLlmApi - using any to avoid import issues
    modelConfig: any, // ModelConfig - using any to avoid import issues
    message: string,
  ): Promise<string | undefined> {
    if (!ChatDescriber.prompt) {
      return;
    }

    // Clean up and distill the message we want to send to the LLM
    message = removeCodeBlocksAndTrim(message);

    if (!message) {
      return;
    }

    try {
      // Create the chat message in the unified format
      const chatMessage = {
        role: "user" as const,
        content: ChatDescriber.prompt + message,
      };

      // Convert to OpenAI format - use a simple fallback to avoid import issues
      const openaiMessages = convertFromUnifiedHistory([
        {
          message: chatMessage,
          contextItems: [],
        },
      ]);

      // Set up completion options for non-streaming
      const completionOptions = {
        model: modelConfig.model,
        messages: openaiMessages,
        max_tokens: ChatDescriber.maxTokens,
        stream: false as const,
      };

      // Call the LLM
      const titleResponse = await llmApi.chatCompletionNonStream(
        completionOptions,
        new AbortController().signal,
      );

      // Extract and clean up the response
      if (titleResponse.choices && titleResponse.choices.length > 0) {
        const content = titleResponse.choices[0].message.content;
        if (content) {
          return removeQuotesAndEscapes(content);
        }
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  //   // TODO: Allow the user to manually set specific/tailored prompts to generate their titles
  //   static async setup() {
  //     if(config?.prompt) {
  //         ChatDescriber.prompt = config?.prompt;
  //     }
  //   }
}
