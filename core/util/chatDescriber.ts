import type { IMessenger } from "./messenger";
import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { ILLM, LLMFullCompletionOptions } from "..";
import { stripImages } from "../llm/images";

/**
 * Removes code blocks from a message.
 *
 * Return modified message text.
 */
function removeCodeBlocksAndTrim(msgText: string): string {
  const codeBlockRegex = /```[\s\S]*?```/g;

  // Remove code blocks from the message text
  const textWithoutCodeBlocks = msgText.replace(codeBlockRegex, "");

  return textWithoutCodeBlocks.trim();
}

export class ChatDescriber {
  static prompt: string | undefined =
    "Given the following... please reply with a short summary that is 4-12 words in length, summarizing what the user is asking for OR what the user is trying to accomplish. You should only respond with the summary, no additional text or explanation.\n\n";
  static messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

  static async describe(
    model: ILLM,
    completionOptions: LLMFullCompletionOptions,
    message: string,
  ) {
    if (!ChatDescriber.prompt) {
      return;
    }

    // Clean up and distill the message we want to send to the LLM
    message = stripImages(message);
    message = removeCodeBlocksAndTrim(message);

    if (!message) {
      return;
    }

    completionOptions.maxTokens = 24;

    // Prompt the user's current LLM for the title
    const titleResponse = await model.chat(
      [
        {
          role: "user",
          content: ChatDescriber.prompt + message,
        },
      ],
      completionOptions,
    );

    // Set the title
    ChatDescriber.messenger?.send("setCurrentChatTitle", titleResponse.content.toString());
  }

  //   // TODO: Allow the user to manually set specific/tailored prompts to generate their titles
  //   static async setup() {
  //     if(config?.prompt) {
  //         ChatDescriber.prompt = config?.prompt;
  //     }
  //   }
}
