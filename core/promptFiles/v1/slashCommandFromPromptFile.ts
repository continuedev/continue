import { ContinueSDK, SlashCommand } from "../..";
import { renderChatMessage } from "../../util/messageContent";
import { getLastNPathParts } from "../../util/uri";
import { parsePromptFileV1V2 } from "../v2/parsePromptFileV1V2";

import { getContextProviderHelpers } from "./getContextProviderHelpers";
import { renderTemplatedString } from "./renderTemplatedString";
import { updateChatHistory } from "./updateChatHistory";

export function extractName(preamble: { name?: string }, path: string): string {
  return preamble.name ?? getLastNPathParts(path, 1).split(".prompt")[0];
}

export function extractUserInput(input: string, commandName: string): string {
  if (input.startsWith(`/${commandName}`)) {
    return input.slice(commandName.length + 1).trimStart();
  }
  return input;
}

async function renderPromptV1(
  prompt: string,
  context: ContinueSDK,
  userInput: string,
) {
  const helpers = getContextProviderHelpers(context);

  const inputData: Record<string, string> = {
    input: userInput,
  };

  // A few context providers that don't need to be in config.json to work in .prompt files
  if (helpers?.find((helper) => helper[0] === "diff")) {
    const diff = await context.ide.getDiff(true);
    inputData.diff = diff.join("\n");
  }
  if (helpers?.find((helper) => helper[0] === "currentFile")) {
    const currentFile = await context.ide.getCurrentFile();
    if (currentFile) {
      inputData.currentFile = currentFile.path;
    }
  }

  return renderTemplatedString(
    prompt,
    context.ide.readFile.bind(context.ide),
    inputData,
    helpers,
  );
}

export function slashCommandFromPromptFileV1(
  path: string,
  content: string,
): SlashCommand | null {
  const { name, description, systemMessage, prompt, version } =
    parsePromptFileV1V2(path, content);

  if (version !== 1) {
    return null;
  }

  return {
    name,
    description,
    run: async function* (context) {
      const originalSystemMessage = context.llm.systemMessage;
      context.llm.systemMessage = systemMessage;

      const userInput = extractUserInput(context.input, name);
      const renderedPrompt = await renderPromptV1(prompt, context, userInput);
      const messages = updateChatHistory(
        context.history,
        name,
        renderedPrompt,
        systemMessage,
      );

      for await (const chunk of context.llm.streamChat(
        messages,
        new AbortController().signal,
      )) {
        yield renderChatMessage(chunk);
      }

      context.llm.systemMessage = originalSystemMessage;
    },
  };
}
