import { fetchwithRequestOptions } from "@continuedev/fetch";
import { ChatMessage, IDE, PromptLog } from "..";
import { ConfigHandler } from "../config/ConfigHandler";
import { ShadowChatDb } from "../data/shadowChatDb";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger, Message } from "../protocol/messenger";
import { deriveSessionId } from "../util/shadowChatSessionId";
import { tokenOptimizedStreamChat } from "./tokenOptimizedChat";

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
    sessionId: clientSessionId,
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
      // Claude Code CLI (core/llm/llms/ClaudeCodeCli.ts) only ever sees the
      // latest user message per call - it has no --resume-based continuity
      // of its own, by design (see ClaudeCodeCli.ts's comments). It depends
      // structurally on tokenOptimizedStreamChat's ShadowChatDb bookkeeping
      // and forced shadow_* tool exposure to have any memory of earlier
      // turns at all, not just as an optional token-saving optimization -
      // so it always takes this path regardless of the user's Ultra Token
      // Saving setting.
      const ultraModeEnabled =
        model.providerName === "claudecode" ||
        (config.ui?.ultraTokenSaving ?? false);
      const historyLimit = 20;
      // Prefer the GUI's real per-conversation ID; fall back to a
      // content-derived one for callers that don't supply it yet.
      const sessionId = clientSessionId ?? deriveSessionId(messages);

      // Guard against toggling Ultra Token Saving mid-conversation
      const storedSession = await ShadowChatDb.getSession(sessionId);
      if (storedSession) {
        if (storedSession.ultraModeEnabled !== ultraModeEnabled) {
          const direction = ultraModeEnabled ? "enabled" : "disabled";
          yield {
            role: "assistant",
            content: `⚠️ Ultra Token Saving has been ${direction}. Please start a new chat to continue.`,
          };
          return errorPromptLog;
        }
      } else {
        // First turn seen for this session — record the current mode
        await ShadowChatDb.createSession(sessionId, ultraModeEnabled);
      }

      const gen = ultraModeEnabled
        ? tokenOptimizedStreamChat(
            model,
            messages,
            abortController.signal,
            completionOptions,
            sessionId,
            historyLimit,
          )
        : model.streamChat(
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

      if (!next.done) {
        throw new Error("Will never happen");
      }

      return next.value;
    }
  } catch (error) {
    // Moved error handling that was here to GUI, keeping try/catch for clean diff
    throw error;
  }
}
