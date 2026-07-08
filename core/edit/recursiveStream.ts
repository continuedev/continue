import {
  ChatMessage,
  ILLM,
  Prediction,
  PromptLog,
  type StreamDiffLinesType,
} from "..";
import { DEFAULT_MAX_TOKENS } from "../llm/constants";
import { countTokens } from "../llm/countTokens";
import { renderChatMessage } from "../util/messageContent";
import { APPLY_UNIQUE_TOKEN } from "./constants.js";

const INFINITE_STREAM_SAFETY = 0.9;

const DUD_PROMPT_LOG: PromptLog = {
  modelTitle: "",
  modelProvider: "",
  prompt: "",
  completion: "",
};

const RECURSIVE_PROMPT = `Continue EXACTLY where you left`;

export async function* recursiveStream(
  llm: ILLM,
  abortController: AbortController,
  type: StreamDiffLinesType,
  prompt: ChatMessage[] | string,
  prediction: Prediction | undefined,
  currentBuffer = "",
  isContinuation = false,
): AsyncGenerator<string | ChatMessage> {
  const maxTokens = llm.completionOptions?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const safeTokens = maxTokens * INFINITE_STREAM_SAFETY;
  let totalTokens = 0;
  let buffer = currentBuffer;
  // let whiteSpaceAtEndOfBuffer = buffer.match(/\s*$/)?.[0] ?? ""; // attempts at fixing whitespace bug with recursive boundaries

  const injectApplyToken = type === "apply" && shouldInjectApplyToken(llm);
  if (typeof prompt === "string") {
    const finalPrompt = injectApplyToken ? prompt + APPLY_UNIQUE_TOKEN : prompt;

    const generator = llm.streamComplete(finalPrompt, abortController.signal, {
      raw: true,
      prediction: undefined,
      reasoning: false,
    });

    for await (const chunk of generator) {
      yield chunk;
      buffer += chunk;
      totalTokens += countTokens(chunk);

      if (totalTokens >= safeTokens) {
        throw new Error(
          "Token limit reached. File/range likely too large for this edit",
        );
        // const continuationPrompt = `${RECURSIVE_PROMPT}:\n\n${buffer}`;

        // await generator.return(DUD_PROMPT_LOG); // kill the previous generator

        // // TODO - Prediction capabilities lost because of partial input
        // yield* recursiveStream(
        //   llm,
        //   abortController,
        //   continuationPrompt,
        //   undefined,
        //   buffer,
        //   true,
        // ); // Recursively stream the continuation

        // return;
      }
    }
  } else {
    const promptMessages = injectApplyToken
      ? appendTokenToLastMessage(prompt, APPLY_UNIQUE_TOKEN)
      : prompt;

    const generator = llm.streamChat(promptMessages, abortController.signal, {
      raw: true,
      prediction: undefined,
      reasoning: false,
    });

    for await (const chunk of generator) {
      yield chunk;
      const rendered = renderChatMessage(chunk);
      buffer += rendered;
      totalTokens += countTokens(chunk.content);

      if (totalTokens >= safeTokens) {
        throw new Error(
          "Token limit reached. File/range likely too large for this edit",
        );
        // const continuationPrompt: ChatMessage[] = [
        //   ...(isContinuation ? prompt.slice(0, -2) : prompt),
        //   {
        //     role: "assistant",
        //     content: buffer,
        //   },
        //   {
        //     role: "user",
        //     content: RECURSIVE_PROMPT,
        //   },
        // ];

        // await generator.return(DUD_PROMPT_LOG);
        // yield* recursiveStream(
        //   llm,
        //   abortController,
        //   continuationPrompt,
        //   undefined,
        //   buffer,
        //   true,
        // );
        // return;
      }
    }
  }
}

function shouldInjectApplyToken(llm: ILLM): boolean {
  const model = llm.model?.toLowerCase() ?? "";
  return (
    llm.underlyingProviderName === "inception" && model.includes("mercury")
  );
}

function appendTokenToLastMessage(
  messages: ChatMessage[],
  token: string,
): ChatMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  const lastMessage = messages[messages.length - 1];
  if (typeof lastMessage.content !== "string") {
    return messages;
  }

  if (lastMessage.content.endsWith(token)) {
    return messages;
  }

  const updatedMessages = [...messages];
  updatedMessages[updatedMessages.length - 1] = {
    ...lastMessage,
    content: lastMessage.content + token,
  };

  return updatedMessages;
}
