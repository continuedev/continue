import {
  Config,
  ContextProviderWithParams,
  ContinueConfig,
  CustomContextProvider,
  CustomLLM,
  IContextProvider,
  ModelDescription,
  SerializedContinueConfig,
  SlashCommand,
} from "..";
import {
  slashCommandFromDescription,
  slashFromCustomCommand,
} from "../commands";
import { contextProviderClassFromName } from "../context/providers";
import CustomContextProviderClass from "../context/providers/CustomContextProvider";
import FileContextProvider from "../context/providers/FileContextProvider";
import { BaseLLM } from "../llm";
import { llmFromDescription } from "../llm/llms";
import CustomLLMClass from "../llm/llms/CustomLLM";

function serializedToIntermediateConfig(
  initial: SerializedContinueConfig
): Config {
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

  const config: Config = {
    ...initial,
    slashCommands,
    contextProviders: initial.contextProviders || [],
  };

  return config;
}

function isModelDescription(
  llm: ModelDescription | CustomLLM
): llm is ModelDescription {
  return (llm as ModelDescription).title !== undefined;
}

function isContextProviderWithParams(
  contextProvider: CustomContextProvider | ContextProviderWithParams
): contextProvider is ContextProviderWithParams {
  return (contextProvider as ContextProviderWithParams).name !== undefined;
}

/** Only difference between intermediate and final configs is the `models` array */
async function intermediateToFinalConfig(
  config: Config,
  readFile: (filepath: string) => Promise<string>
): Promise<ContinueConfig> {
  const models: BaseLLM[] = [];
  for (const desc of config.models) {
    let llm: BaseLLM | undefined;
    if (isModelDescription(desc)) {
      llm = await llmFromDescription(
        desc,
        readFile,
        config.completionOptions,
        config.systemMessage
      );
    } else {
      llm = new CustomLLMClass(desc);
    }
    if (!llm) continue;
    models.push(llm);
  }

  const contextProviders: IContextProvider[] = [new FileContextProvider({})];
  for (const provider of config.contextProviders || []) {
    if (isContextProviderWithParams(provider)) {
      const cls = contextProviderClassFromName(provider.name) as any;
      if (!cls) {
        console.warn(`Unknown context provider ${provider.name}`);
        continue;
      }
      contextProviders.push(new cls(provider.params));
    } else {
      contextProviders.push(new CustomContextProviderClass(provider));
    }
  }

  return {
    ...config,
    contextProviders,
    models,
  };
}

export { intermediateToFinalConfig, serializedToIntermediateConfig };
