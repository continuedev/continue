import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { constructLlmApi, LLMConfig } from "@continuedev/openai-adapters";

import {
  AuthConfig,
  getAccessToken,
  getOrganizationId,
  getModelName,
} from "../auth/workos.js";
import { getLlmApi } from "../config.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { ModelServiceState } from "./types.js";

/**
 * Service for managing LLM and model state
 * Depends on auth config and assistant config
 */
export class ModelService
  extends BaseService<ModelServiceState>
  implements ServiceWithDependencies
{
  private availableModels: ModelConfig[] = [];
  private assistant: AssistantUnrolled | null = null;
  private authConfig: AuthConfig | null = null;

  constructor() {
    super("ModelService", {
      llmApi: null,
      model: null,
    });
  }

  /**
   * Declare dependencies on other services
   */
  getDependencies(): string[] {
    return ["auth", "config"];
  }

  /**
   * Initialize the model service
   */
  async doInitialize(
    assistant: AssistantUnrolled,
    authConfig: AuthConfig,
  ): Promise<ModelServiceState> {
    this.assistant = assistant;
    this.authConfig = authConfig;
    this.availableModels = (assistant.models?.filter(
      (model) => model && model.roles?.includes("chat"),
    ) || []) as ModelConfig[];

    // Check if we have a persisted model name and use it if valid
    const persistedModelName = getModelName(authConfig);
    if (persistedModelName) {
      const modelIndex = this.getModelIndexByName(persistedModelName);
      if (modelIndex !== -1) {
        // Use the persisted model
        const state = await this.switchModel(modelIndex);
        return state;
      } else {
        // Model name not found, use default model selection
        const [llmApi, model] = getLlmApi(assistant, authConfig);
        return {
          llmApi,
          model,
        };
      }
    } else {
      // Use default model selection
      const [llmApi, model] = getLlmApi(assistant, authConfig);
      return {
        llmApi,
        model,
      };
    }
  }

  /**
   * Update the model based on new config or auth changes
   */
  async update(
    assistant: AssistantUnrolled,
    authConfig: AuthConfig,
  ): Promise<ModelServiceState> {
    logger.debug("Updating ModelService");

    try {
      this.assistant = assistant;
      this.authConfig = authConfig;
      this.availableModels = (assistant.models?.filter(
        (model) => model && model.roles?.includes("chat"),
      ) || []) as ModelConfig[];

      const [llmApi, model] = getLlmApi(assistant, authConfig);

      this.setState({
        llmApi,
        model,
      });

      logger.debug("ModelService updated successfully", {
        modelProvider: model.provider,
        modelName: (model as any).name || "unnamed",
        availableModels: this.availableModels.length,
      });

      return this.getState();
    } catch (error: any) {
      logger.error("Failed to update ModelService:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Override isReady to check for required state
   */
  override isReady(): boolean {
    return (
      super.isReady() &&
      this.currentState.llmApi !== null &&
      this.currentState.model !== null
    );
  }

  /**
   * Get model information for display
   */
  getModelInfo(): { provider: string; name: string } | null {
    if (!this.currentState.model) {
      return null;
    }

    return {
      provider: this.currentState.model.provider,
      name: (this.currentState.model as any).name || "unnamed",
    };
  }

  /**
   * Get list of available chat models
   */
  getAvailableChatModels(): Array<{
    provider: string;
    name: string;
    index: number;
  }> {
    return this.availableModels.map((model, index) => ({
      provider: model.provider,
      name: (model as any).name || (model as any).model || "unnamed",
      index,
    }));
  }

  /**
   * Switch to a different chat model by index
   */
  async switchModel(modelIndex: number): Promise<ModelServiceState> {
    if (!this.assistant || !this.authConfig) {
      throw new Error("ModelService not initialized");
    }

    if (modelIndex < 0 || modelIndex >= this.availableModels.length) {
      throw new Error(
        `Invalid model index: ${modelIndex}. Available models: 0-${this.availableModels.length - 1}`,
      );
    }

    const selectedModel = this.availableModels[modelIndex];
    logger.debug("Switching to model", {
      modelIndex,
      provider: selectedModel.provider,
      name: (selectedModel as any).name || "unnamed",
    });

    try {
      const accessToken = getAccessToken(this.authConfig);
      const organizationId = getOrganizationId(this.authConfig);

      const config: LLMConfig =
        selectedModel.provider === "continue-proxy"
          ? {
              provider: selectedModel.provider,
              requestOptions: selectedModel.requestOptions,
              apiBase: selectedModel.apiBase,
              apiKey: accessToken ?? undefined,
              env: {
                apiKeyLocation: (selectedModel as any).apiKeyLocation,
                orgScopeId: organizationId,
                proxyUrl: undefined,
              },
            }
          : {
              provider: selectedModel.provider as any,
              apiKey: selectedModel.apiKey,
              apiBase: selectedModel.apiBase,
              requestOptions: selectedModel.requestOptions,
              env: selectedModel.env,
            };

      const llmApi = constructLlmApi(config);

      if (!llmApi) {
        throw new Error("Failed to initialize LLM with selected model");
      }

      this.setState({
        llmApi,
        model: selectedModel,
      });

      logger.debug("Model switched successfully", {
        modelProvider: selectedModel.provider,
        modelName: (selectedModel as any).name || "unnamed",
      });

      return this.getState();
    } catch (error: any) {
      logger.error("Failed to switch model:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Get current model index
   */
  getCurrentModelIndex(): number {
    if (!this.currentState.model) {
      return -1;
    }

    return this.availableModels.findIndex(
      (model) =>
        model.provider === this.currentState.model?.provider &&
        (model as any).name === (this.currentState.model as any).name,
    );
  }

  /**
   * Get model index by name and provider
   */
  getModelIndexByName(modelName: string, provider?: string): number {
    return this.availableModels.findIndex((model) => {
      const name = (model as any).name || (model as any).model;
      const nameMatches = name === modelName;

      if (provider) {
        return nameMatches && model.provider === provider;
      }

      return nameMatches;
    });
  }
}
