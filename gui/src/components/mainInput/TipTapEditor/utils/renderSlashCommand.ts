import { MessagePart, RangeInFile, SlashCommandDescWithSource } from "core";
import { stripImages } from "core/util/messageContent";
import posthog from "posthog-js";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { renderMcpPrompt } from "./renderMcpPrompt";
import { getRenderedV1Prompt } from "./renderPromptv1";
import { getPromptV2ContextRequests } from "./renderPromptv2";
import { GetContextRequest } from "./types";

/*
Slash commands can come from many sources. Render based on the source.
*/
export async function renderSlashCommandPrompt(
  ideMessenger: IIdeMessenger,
  commandName: string | undefined,
  parts: MessagePart[],
  availableSlashCommands: SlashCommandDescWithSource[],
  selectedCode: RangeInFile[],
): Promise<{
  slashedParts: MessagePart[];
  legacyCommandWithInput?: {
    command: SlashCommandDescWithSource;
    input: string;
  };
  contextRequests: GetContextRequest[];
}> {
  const NO_COMMAND = {
    slashedParts: parts,
    legacyCommandWithInput: undefined,
    contextRequests: [],
  };
  if (!commandName) {
    return NO_COMMAND;
  }
  const command = availableSlashCommands.find((c) => c.name === commandName);
  if (!command) {
    return NO_COMMAND;
  }

  try {
    posthog.capture("useSlashCommand", {
      name: command.name,
      source: command.source,
      isLegacy: command.isLegacy,
    });
  } catch (e) {
    console.error(e);
  }

  const nonTextParts = parts.filter((part) => part.type !== "text");
  const textParts = parts.filter((part) => part.type === "text");
  const slashedParts: MessagePart[] = [...nonTextParts];

  const userInput = stripImages(textParts).trimStart();

  const legacyCommandWithInput = command.isLegacy
    ? {
        command,
        input: userInput,
      }
    : undefined;

  const contextRequests: GetContextRequest[] = [];

  switch (command.source) {
    case "built-in-legacy":
    case "config-ts-slash-command":
      /**
       * For legacy slash commands, we simply insert the text "/{name}" in front of the message
       * And then parsing for this is done in core
       */
      slashedParts.push({
        type: "text",
        text: `/${command.name}${command.prompt ? " " + command.prompt : ""}${userInput ? " " + userInput : ""}`,
      });
      break;
    case "mcp-prompt":
      const renderedMcpPrompt = await renderMcpPrompt(
        command,
        ideMessenger,
        userInput,
      );
      slashedParts.push({
        type: "text",
        text: renderedMcpPrompt,
      });
      break;
    case "prompt-file-v1":
    case "prompt-file-v2":
    case "yaml-prompt-block":
    case "invokable-rule":
      if (!command.prompt) {
        console.warn(`Invalid/empty prompt from slash command ${command.name}`);
        break;
      }
      let renderedPrompt: string;
      if (
        command.source === "prompt-file-v1" ||
        command.prompt.includes("{{{ input }}}")
      ) {
        renderedPrompt = await getRenderedV1Prompt(
          ideMessenger,
          command,
          userInput,
          selectedCode,
        );
      } else {
        const promptFileCtxRequests = await getPromptV2ContextRequests(
          ideMessenger,
          command,
        );
        contextRequests.push(...promptFileCtxRequests);
        renderedPrompt = [command.prompt, userInput].join("\n\n").trim();
      }

      if (renderedPrompt) {
        slashedParts.push({
          type: "text",
          text: renderedPrompt, // Includes user input
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }

      break;
    case "built-in":
    case "json-custom-command":
      if (!command.prompt) {
        console.warn(`Slash command ${command.name} is missing prompt`);
        break;
      }
      let rendered = command.prompt;
      if (userInput) {
        rendered += `\n\n${userInput}`;
      }
      if (rendered) {
        slashedParts.push({
          type: "text",
          text: rendered,
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }
    default:
      break;
  }
  return {
    slashedParts,
    legacyCommandWithInput,
    contextRequests,
  };
}
