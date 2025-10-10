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

  let hasToolCalls = false; // Track if we're streaming tool calls

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
      let accumulatedChunks: ChatMessage[] = [];

      while (!next.done) {
        if (abortController.signal.aborted) {
          next = await gen.return(errorPromptLog);
          break;
        }

        const chunk = next.value;
        accumulatedChunks.push(chunk);

        // Track if we've seen any tool calls (only assistant/thinking messages have toolCalls)
        if (
          (chunk.role === "assistant" || chunk.role === "thinking") &&
          chunk.toolCalls &&
          chunk.toolCalls.length > 0
        ) {
          hasToolCalls = true;
        }

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
    const isPrematureClose =
      error instanceof Error &&
      error.message.toLowerCase().includes("premature close");

    if (isPrematureClose) {
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

    // For premature close during tool calls, don't throw - instead yield error as tool result
    // This allows the model to recover by trying again with more concise output
    if (isPrematureClose && hasToolCalls) {
      void Telemetry.capture(
        "premature_close_tool_call_recovery",
        {
          model: model.model,
          provider: model.providerName,
        },
        false,
      );

      // Yield error message as tool result so model can see it failed
      yield {
        role: "tool" as const,
        content: `Error: The previous tool call response was cancelled mid-stream due to network issues (Premature Close). Please try again with more concise, focused output. Consider:
- Reducing the amount of data returned
- Breaking large responses into smaller chunks
- Using more targeted queries
- Limiting result sets`,
        toolCallId: "error", // Placeholder ID
      };

      return errorPromptLog;
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
