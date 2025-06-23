import { ContinueSDK, SlashCommandWithSource } from "../..";
import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache";
import { parsePromptFileV1V2 } from "../../promptFiles/v2/parsePromptFileV1V2";
import { getLastNPathParts } from "../../util/uri";

import { getContextProviderHelpers } from "../../promptFiles/v1/getContextProviderHelpers";
import { renderTemplatedString } from "../../promptFiles/v1/renderTemplatedString";

export function extractName(preamble: { name?: string }, path: string): string {
  return preamble.name ?? getLastNPathParts(path, 1).split(".prompt")[0];
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
    const diffs = await getDiffsFromCache(context.ide);
    inputData.diff = diffs.join("\n");
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
): SlashCommandWithSource | null {
  const { name, description, systemMessage, prompt } = parsePromptFileV1V2(
    path,
    content,
  );

  return {
    name,
    description,
    prompt,
    source: ".prompt-file",
    promptFile: path,
  };
}
