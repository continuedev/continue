import { SlashCommand } from "..";
import { stripImages } from "../llm/images";
import { getContextProviderHelpers } from "./getContextProviderHelpers";
import { renderTemplatedString } from "./renderTemplatedString";
import { updateChatHistory } from "./updateChatHistory";
import * as YAML from "yaml";
import { getBasename } from "../util/index";

export function extractName(preamble: { name?: string }, path: string): string {
  return preamble.name ?? getBasename(path).split(".prompt")[0];
}

export function parsePromptFile(path: string, content: string) {
  let [preambleRaw, prompt] = content.split("\n---\n");
  if (prompt === undefined) {
    prompt = preambleRaw;
    preambleRaw = "";
  }

  const preamble = YAML.parse(preambleRaw) ?? {};
  const name = extractName(preamble, path);
  const description = preamble.description ?? name;

  let systemMessage: string | undefined = undefined;
  if (prompt.includes("<system>")) {
    systemMessage = prompt.split("<system>")[1].split("</system>")[0].trim();
    prompt = prompt.split("</system>")[1].trim();
  }

  return { name, description, systemMessage, prompt };
}

export function extractUserInput(input: string, commandName: string): string {
  if (input.startsWith(`/${commandName}`)) {
    return input.slice(commandName.length + 1).trimStart();
  }
  return input;
}

export async function getDefaultVariables(context: any, userInput: string) {
  const currentFilePath = await context.ide.getCurrentFile();
  const currentFile = currentFilePath
    ? await context.ide.readFile(currentFilePath)
    : undefined;

  return { currentFile, input: userInput };
}

export async function renderPrompt(
  prompt: string,
  context: any,
  userInput: string,
) {
  const helpers = getContextProviderHelpers(context);

  const inputData = await getDefaultVariables(context, userInput);

  return renderTemplatedString(
    prompt,
    context.ide.readFile.bind(context.ide),
    inputData,
    helpers,
  );
}

export function slashCommandFromPromptFile(
  path: string,
  content: string,
): SlashCommand {
  const { name, description, systemMessage, prompt } = parsePromptFile(
    path,
    content,
  );

  return {
    name,
    description,
    run: async function* (context) {
      const userInput = extractUserInput(context.input, name);
      const renderedPrompt = await renderPrompt(prompt, context, userInput);
      const messages = updateChatHistory(
        context.history,
        name,
        renderedPrompt,
        systemMessage,
      );

      for await (const chunk of context.llm.streamChat(messages)) {
        yield stripImages(chunk.content);
      }
    },
  };
}
