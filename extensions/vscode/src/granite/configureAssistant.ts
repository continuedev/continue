/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

interface ModelConfig {
  model: string;
  title?: string;
  apiBase?: string;
  provider?: string;
  contextLength?: number;
  systemMessage?: string;
  apiKey?: string;
  completionOptions?: CompletionOptions;
}

interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface AiAssistantConfigurationRequest {
  chatModel: string | null;
  tabCompletionModel: string | null;
  embeddingsModel: string | null;
}

const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_API_BASE = "http://localhost:11434";
const DEFAULT_PROVIDER = "ollama";

//See https://github.com/continuedev/continue/blob/51f4d1b48b7e9fb007b08d344d1afdb725b1a970/core/util/paths.ts#L14-L15
const CONTINUE_GLOBAL_DIR = process.env.CONTINUE_GLOBAL_DIR ?? path.join(os.homedir(), ".continue");
const CONTINUE_CONFIG_FILE = path.join(CONTINUE_GLOBAL_DIR, "config.json");

const baseConfig: Partial<ModelConfig> = {
  provider: DEFAULT_PROVIDER,
};

const baseGraniteConfig: Partial<ModelConfig> = {
  ...baseConfig,
  contextLength: DEFAULT_CONTEXT_LENGTH,
  completionOptions: {
    maxTokens: DEFAULT_CONTEXT_LENGTH / 4,
    temperature: 0,
    topP: 0.9,
    topK: 40,
    presencePenalty: 0.0,
    frequencyPenalty: 0.1
  },
  systemMessage: "You are Granite, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior.",
};

const modelConfigs: ModelConfig[] = [
  {
    model: "granite-code:3b",
    ...baseGraniteConfig,
    contextLength: 24000,
  },
  {
    model: "granite-code:8b",
    ...baseGraniteConfig,
    contextLength: 128000,
  },
  {
    model: "granite3.1-dense:2b",
    ...baseGraniteConfig,
  },
  {
    model: "granite3.1-dense:8b",
    ...baseGraniteConfig,
  },
  {
    model: "nomic-embed-text",
    ...baseConfig,
  }
];

function getModelConfig(model: string): ModelConfig {
  let modelConfig = modelConfigs.find(m => m.model === model);
  if (!modelConfig) {
    const configTemplate = model.includes("granite") ? baseGraniteConfig : baseConfig;
    modelConfig = {
      ...configTemplate,
      model,
    };
  }
  modelConfig.title = model;
  return modelConfig;
}

export class AiAssistantConfigurator {

  private apiBase: string;

  constructor(private request: AiAssistantConfigurationRequest) {
    this.apiBase = DEFAULT_API_BASE;
  }

  private async mightShowContinueOnboarding(models: ModelConfig[]) {
    if (!models) {
      return false;
    }
    return models.length === 1 && this.isDefaultModel(models[0]);
  }

  private async isDefaultModel(model: ModelConfig) {
    return model.provider === "anthropic" && model.apiKey === "";
  }

  public async openWizard() {
    if (isContinueInstalled()) {
      await this.configureAssistant();
    } else {
      return; //await recommendContinue();
    }
  }

  async configureAssistant() {
    const config = await readConfig(CONTINUE_CONFIG_FILE);
    if (!config) {
      return vscode.window.showErrorMessage(`No ${CONTINUE_CONFIG_FILE} found`);
    }
    // Check if we should show the Continue Onboarding message
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const models: ModelConfig[] = config.models === undefined ? [] : config.models;
    const continueOnboardingMightShow = await this.mightShowContinueOnboarding(models);

    // check if model object is already in the config json
    let updateConfig = false;
    if (this.request.chatModel) {
      const modelConfig = getModelConfig(this.request.chatModel);
      const existing = continueOnboardingMightShow ? models[0] : // there's only 1 model, and it's the default one, we'll replace it
        models.find((m) => modelConfig.provider === m.provider && this.getApiBase(modelConfig) === this.getApiBase(m));
      if (existing) {
        const index = models.indexOf(existing);
        // if model config is different or it's not the first model, change that
        if (existing !== modelConfig || index !== 0) {
          models.splice(index, 1);
          models.unshift(modelConfig);
          updateConfig = true;
        }
      } else {
        //push model to the 1st position
        models.unshift(modelConfig);
        updateConfig = true;
      }
      config.models = models;
    }
    // Configure tab autocomplete model if it exists
    if (this.request.tabCompletionModel) {
      const modelConfig = getModelConfig(this.request.tabCompletionModel);
      if (modelConfig !== config.tabAutocompleteModel) {
        config.tabAutocompleteModel = modelConfig;
        updateConfig = true;
      }
    }

    // Configure embeddings model if it exists
    if (this.request.embeddingsModel) {
      const modelConfig = getModelConfig(this.request.embeddingsModel);
      if (modelConfig !== config.embeddingsProvider) {
        config.embeddingsProvider = modelConfig;
        updateConfig = true;
      }
    }

    if (updateConfig) {
      await writeConfig(CONTINUE_CONFIG_FILE, config);
      const currentChatModel = this.request.chatModel ?? null;
      let message = "Continue configuration completed.";
      if (currentChatModel) {
        message += ` Now select '${currentChatModel}' from Continue's chat model dropdown.`;
      }
      vscode.window.showInformationMessage(message, "");
    }

    if (continueOnboardingMightShow) {
      vscode.window.showInformationMessage(
        "If the Continue view shows onboarding options, they can safely be closed. Otherwise you risk overwriting the Granite configuration.", ""
      );
    }
  }

  getApiBase(model: ModelConfig): string {
    return model.apiBase || this.apiBase;
  }
}

export const CONTINUE_EXTENSION_ID = "Continue.continue";

function isContinueInstalled(): boolean {
  const continueExt = vscode.extensions.getExtension(CONTINUE_EXTENSION_ID);
  return continueExt !== undefined;
}

export async function readConfig(configFile: string): Promise<any> {
  try {
    await fs.access(configFile, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Config file ${configFile} not found.`);
  }
  const configContent = await fs.readFile(configFile, "utf8");
  if (!configContent) {
    return {};
  }
  const configData = JSON.parse(configContent);
  return configData;
}

async function writeConfig(configFile: string, config: any): Promise<void> {
  try {
    //const insertSpaces = vscode.workspace.getConfiguration().get<boolean>('editor.insertSpaces');
    const tabSize = vscode.workspace
      .getConfiguration()
      .get<number>("editor.tabSize");
    const configContent = JSON.stringify(config, null, tabSize);
    return fs.writeFile(configFile, configContent, "utf8");
  } catch (error) {
    throw new Error(`Config file ${configFile} not found.`);
  }
}
