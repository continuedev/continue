import { ChatMessage, ILLM, Prediction, PromptLog } from "..";
import { DEFAULT_MAX_TOKENS } from "../llm/constants";
import { countTokens } from "../llm/countTokens";
import { renderChatMessage } from "../util/messageContent";

const INFINITE_STREAM_SAFETY = 0.9;

const DUD_PROMPT_LOG: PromptLog = {
  modelTitle: "",
  completionOptions: { model: "" },
  prompt: "",
  completion: "",
};

const RECURSIVE_PROMPT = `Continue EXACTLY where you left`;

export async function* recursiveStream(
  llm: ILLM,
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

  if (typeof prompt === "string") {
    const generator = llm.streamComplete(prompt, new AbortController().signal, {
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
        //   continuationPrompt,
        //   undefined,
        //   buffer,
        //   true,
        // ); // Recursively stream the continuation

        // return;
      }
    }
  } else {
    const generator = llm.streamChat(prompt, new AbortController().signal, {
      prediction,
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
