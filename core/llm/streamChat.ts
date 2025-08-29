import { fetchwithRequestOptions } from "@continuedev/fetch";
import { ChatMessage, IDE, PromptLog } from "..";
import { ConfigHandler } from "../config/ConfigHandler";
import { usesFreeTrialApiKey } from "../config/usesFreeTrialApiKey";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger, Message } from "../protocol/messenger";
import { Telemetry } from "../util/posthog";
import { TTS } from "../util/tts";

export async function* llmStreamChat(
  configHandler: ConfigHandler,
  abortController: AbortController,
  msg: Message<ToCoreProtocol["llm/streamChat"][0]>,
  ide: IDE,
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
): AsyncGenerator<ChatMessage, PromptLog> {
  const { config } = await configHandler.loadConfig();
  if (!config) {
    throw new Error("Config not loaded");
  }

  // Stop TTS on new StreamChat
  if (config.experimental?.readResponseTTS) {
    void TTS.kill();
  }

  const {
    legacySlashCommandData,
    completionOptions,
    messages,
    messageOptions,
  } = msg.data;

  const model = config.selectedModelByRole.chat;

  if (!model) {
    throw new Error("No chat model selected");
  }

  // Log to return in case of error
  const errorPromptLog = {
    modelTitle: model?.title ?? model?.model,
    modelProvider: model?.underlyingProviderName ?? "unknown",
    completion: "",
    prompt: "",
    completionOptions: {
      ...msg.data.completionOptions,
      model: model?.model,
    },
  };

  try {
    if (legacySlashCommandData) {
      const { command, contextItems, historyIndex, input, selectedCode } =
        legacySlashCommandData;
      const slashCommand = config.slashCommands?.find(
        (sc) => sc.name === command.name,
      );
      if (!slashCommand) {
        throw new Error(`Unknown slash command ${command.name}`);
      }
      void Telemetry.capture(
        "useSlashCommand",
        {
          name: command.name,
        },
        true,
      );
      if (!slashCommand.run) {
        console.error(
          `Slash command ${command.name} (${command.source}) has no run function`,
        );
        throw new Error(`Slash command not found`);
      }

      const gen = slashCommand.run({
        input,
        history: messages,
        llm: model,
        contextItems,
        params: command.params,
        ide,
        addContextItem: (item) => {
          void messenger.request("addContextItem", {
            item,
            historyIndex,
          });
        },
        selectedCode,
        config,
        fetch: (url, init) =>
          fetchwithRequestOptions(
            url,
            {
              ...init,
              signal: abortController.signal,
            },
            model.requestOptions,
          ),
        completionOptions,
        abortController,
      });
      let next = await gen.next();
      while (!next.done) {
        if (abortController.signal.aborted) {
          next = await gen.return(errorPromptLog);
          break;
        }
        if (next.value) {
          yield {
            role: "assistant",
            content: next.value,
          };
        }
        next = await gen.next();
      }
      if (!next.done) {
        throw new Error("Will never happen");
      }

      return next.value;
    } else {
      const gen = model.streamChat(
        messages,
        abortController.signal,
        completionOptions,
        messageOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (abortController.signal.aborted) {
          next = await gen.return(errorPromptLog);
          break;
        }

        const chunk = next.value;

        yield chunk;
        next = await gen.next();
      }
      if (config.experimental?.readResponseTTS && "completion" in next.value) {
        void TTS.read(next.value?.completion);
      }

      void Telemetry.capture(
        "chat",
        {
          model: model.model,
          provider: model.providerName,
        },
        true,
      );

      void checkForFreeTrialExceeded(configHandler, messenger);

      if (!next.done) {
        throw new Error("Will never happen");
      }

      return next.value;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("premature close")
    ) {
      void Telemetry.capture(
        "stream_premature_close_error",
        {
          model: model.model,
          provider: model.providerName,
          errorMessage: error.message,
          context: legacySlashCommandData ? "slash_command" : "regular_chat",
          ...(legacySlashCommandData && {
            command: legacySlashCommandData.command.name,
          }),
        },
        false,
      );
    }
    throw error;
  }
}

async function checkForFreeTrialExceeded(
  configHandler: ConfigHandler,
  messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>,
) {
  const { config } = await configHandler.getSerializedConfig();

  // Only check if the user is using the free trial
  if (config && !usesFreeTrialApiKey(config)) {
    return;
  }

  try {
    const freeTrialStatus =
      await configHandler.controlPlaneClient.getFreeTrialStatus();
    if (
      freeTrialStatus &&
      freeTrialStatus.chatCount &&
      freeTrialStatus.chatCount > freeTrialStatus.chatLimit
    ) {
      void messenger.request("freeTrialExceeded", undefined);
    }
  } catch (error) {
    console.error("Error checking free trial status:", error);
  }
}
