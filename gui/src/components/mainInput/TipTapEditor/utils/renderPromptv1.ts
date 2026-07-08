import {
  ContextProviderName,
  RangeInFile,
  SlashCommandDescWithSource,
} from "core";
import { SUPPORTED_PROMPT_CONTEXT_PROVIDERS } from "core/promptFiles";
import { renderTemplatedString } from "core/util/handlebars/renderTemplatedString";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { IIdeMessenger } from "../../../../context/IdeMessenger";

export async function getRenderedV1Prompt(
  ideMessenger: IIdeMessenger,
  command: SlashCommandDescWithSource,
  userInput: string,
  selectedCode: RangeInFile[],
): Promise<string> {
  if (!command.prompt) {
    return "";
  }
  const handleBarHelpers = SUPPORTED_PROMPT_CONTEXT_PROVIDERS.map(
    (name: ContextProviderName): [string, Handlebars.HelperDelegate] => [
      name,
      async (helperContext: any) => {
        const response = await ideMessenger.request("context/getContextItems", {
          fullInput: userInput,
          name,
          query: "",
          selectedCode,
          isInAgentMode: false,
        });
        if (response.status === "success") {
          return response.content.map((item) => item.content).join("\n\n");
        } else {
          throw new Error(
            `Failed to get context items from provider "${name}": ${response.error}`,
          );
        }
      },
    ],
  );
  const workspaceDirs = await ideMessenger.ide.getWorkspaceDirs();
  const getUriFromPath = (path: string) => {
    return resolveRelativePathInDir(path, ideMessenger.ide, workspaceDirs);
  };
  const handlebars = (await import("handlebars")).default;
  let rendered = await renderTemplatedString(
    handlebars,
    command.prompt,
    { input: userInput },
    handleBarHelpers,
    ideMessenger.ide.readFile.bind(ideMessenger.ide),
    getUriFromPath,
  );
  // For prompt file append the input if it isn't rendered
  if (!rendered.includes(userInput)) {
    rendered = rendered + `\n\n${userInput}`;
  }
  return rendered.trim();
}
