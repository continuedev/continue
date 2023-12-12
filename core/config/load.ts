import { ContinueConfig, SerializedContinueConfig } from ".";
import {
  SlashCommand,
  slashCommandFromDescription,
  slashFromCustomCommand,
} from "../commands";
import { ContextProvider } from "../context";
import { contextProviderClassFromName } from "../context/providers";
import FileContextProvider from "../context/providers/FileContextProvider";
import { LLM } from "../llm";
import { llmFromDescription } from "../llm/llms";

function loadSerializedConfig(
  initial: SerializedContinueConfig
): ContinueConfig {
  const models: LLM[] = [];
  for (const desc of initial.models) {
    const llm = llmFromDescription(desc, initial.completionOptions);
    if (!llm) continue;
    models.push(llm);
  }

  const slashCommands: SlashCommand[] = [];
  for (const command of initial.slashCommands || []) {
    const newCommand = slashCommandFromDescription(command);
    if (newCommand) {
      slashCommands.push(newCommand);
    }
  }
  for (const command of initial.customCommands || []) {
    slashCommands.push(slashFromCustomCommand(command));
  }

  const contextProviders: ContextProvider[] = [new FileContextProvider({})];
  for (const provider of initial.contextProviders || []) {
    const cls = contextProviderClassFromName(provider.name) as any;
    if (!cls) {
      console.warn(`Unknown context provider ${provider.name}`);
      continue;
    }
    contextProviders.push(new cls(provider.params));
  }

  const config: ContinueConfig = {
    allowAnonymousTelemetry: initial.allowAnonymousTelemetry,
    models,
    systemMessage: initial.systemMessage,
    completionOptions: initial.completionOptions,
    slashCommands,
    contextProviders,
    retrievalSettings: initial.retrievalSettings,
    disableIndexing: initial.disableIndexing,
  };

  return config;
}

export { loadSerializedConfig };
