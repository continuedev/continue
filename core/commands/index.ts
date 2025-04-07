import { CustomCommand, SlashCommand, SlashCommandDescription } from "../";
import { renderTemplatedString } from "../promptFiles/v1/renderTemplatedString";
import { replaceSlashCommandWithPromptInChatHistory } from "../promptFiles/v1/updateChatHistory";
import { renderPromptFileV2 } from "../promptFiles/v2/renderPromptFile";
import { renderChatMessage } from "../util/messageContent";

import SlashCommands from "./slash";

export function slashFromCustomCommand(
  customCommand: CustomCommand,
): SlashCommand {
  const commandName = customCommand.name.startsWith("/")
    ? customCommand.name.substring(1)
    : customCommand.name;
  return {
    name: commandName,
    description: customCommand.description ?? "",
    prompt: customCommand.prompt,
    run: async function* ({
      input,
      llm,
      history,
      ide,
      completionOptions,
      config,
      selectedCode,
      fetch,
    }) {
      // Render prompt template
      let renderedPrompt: string;
      if (customCommand.prompt.includes("{{{ input }}}")) {
        renderedPrompt = await renderTemplatedString(
          customCommand.prompt,
          ide.readFile.bind(ide),
          { input },
        );
      } else {
        renderedPrompt = await renderPromptFileV2(customCommand.prompt, {
          config,
          llm,
          ide,
          selectedCode,
          fetch,
          fullInput: input,
          embeddingsProvider: config.modelsByRole.embed[0],
          reranker: config.modelsByRole.rerank[0],
        });
      }

      // Replaces slash command messages with the rendered prompt
      // which INCLUDES the input
      const messages = replaceSlashCommandWithPromptInChatHistory(
        history,
        commandName,
        renderedPrompt,
        undefined,
      );

      for await (const chunk of llm.streamChat(
        messages,
        new AbortController().signal,
        completionOptions,
      )) {
        yield renderChatMessage(chunk);
      }
    },
  };
}

export function slashCommandFromDescription(
  desc: SlashCommandDescription,
): SlashCommand | undefined {
  const cmd = SlashCommands.find((cmd) => cmd.name === desc.name);
  if (!cmd) {
    return undefined;
  }
  return {
    ...cmd,
    params: desc.params,
    description: desc.description ?? cmd.description,
  };
}
