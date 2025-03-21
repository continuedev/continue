import { fetchwithRequestOptions } from "@continuedev/fetch";
import { ChatMessage, IDE, PromptLog } from "..";
import { ConfigHandler } from "../config/ConfigHandler";
import { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import { IMessenger, Message } from "../protocol/messenger";
import { Telemetry } from "../util/posthog";
import { TTS } from "../util/tts";

export async function* llmStreamChat(
  configHandler: ConfigHandler,
  abortedMessageIds: Set<string>,
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

  const { title, legacySlashCommandData, completionOptions, messages } =
    msg.data;

  const model = await configHandler.llmFromTitle(title);

  // Log to return in case of error
  const errorPromptLog = {
    modelTitle: model.title ?? model.model,
    completion: "",
    prompt: "",
    completionOptions: {
      ...msg.data.completionOptions,
      model: model.model,
    },
  };

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
        fetchwithRequestOptions(url, init, config.requestOptions),
      completionOptions,
    });
    const checkActiveInterval = setInterval(() => {
      if (abortedMessageIds.has(msg.messageId)) {
        abortedMessageIds.delete(msg.messageId);
        clearInterval(checkActiveInterval);
      }
    }, 100);
    try {
      let next = await gen.next();
      while (!next.done) {
        if (abortedMessageIds.has(msg.messageId)) {
          abortedMessageIds.delete(msg.messageId);
          next = await gen.return(errorPromptLog);
          clearInterval(checkActiveInterval);
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
    } catch (e) {
      throw e;
    } finally {
      clearInterval(checkActiveInterval);
    }
  } else {
    const gen = model.streamChat(
      messages,
      new AbortController().signal,
      completionOptions,
    );
    let next = await gen.next();
    while (!next.done) {
      if (abortedMessageIds.has(msg.messageId)) {
        abortedMessageIds.delete(msg.messageId);
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

    if (!next.done) {
      throw new Error("Will never happen");
    }

    return next.value;
  }
}
