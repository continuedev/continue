import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { constructLlmApi, LLMConfig } from "@continuedev/openai-adapters";

import {
  AuthConfig,
  getAccessToken,
  getModelName,
  getOrganizationId,
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
      assistant: null,
      authConfig: null,
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
    logger.debug("ModelService.doInitialize called", {
      hasAssistant: !!assistant,
      hasAuthConfig: !!authConfig,
      assistantModelsCount: assistant?.models?.length || 0,
    });

    this.assistant = assistant;
    this.authConfig = authConfig;
    this.availableModels = (assistant.models?.filter(
      (model) =>
        model && (model.roles?.includes("chat") || model.roles === undefined),
    ) || []) as ModelConfig[];

    // Check if we have a persisted model name and use it if valid
    const persistedModelName = getModelName(authConfig);
    if (persistedModelName) {
      // During initialization, we need to check against availableModels directly
      const modelIndex = this.availableModels.findIndex((model) => {
        const name = (model as any).name || (model as any).model;
        return name === persistedModelName;
      });
      if (modelIndex === -1) {
        // Model name not found, use default model selection
        const [llmApi, model] = getLlmApi(assistant, authConfig);
        return {
          llmApi,
          model,
          assistant,
          authConfig,
        };
      } else {
        // Use the persisted model - but we need to handle initialization specially
        // During init, currentState isn't set yet, so switchModel would fail
        // Instead, we'll manually switch here
        const selectedModel = this.availableModels[modelIndex];
        logger.debug("Using persisted model during initialization", {
          modelIndex,
          provider: selectedModel.provider,
          name: (selectedModel as any).name || "unnamed",
        });

        const accessToken = getAccessToken(authConfig);
        const organizationId = getOrganizationId(authConfig);

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
                  proxyUrl: (selectedModel as any).onPremProxyUrl ?? undefined,
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
          throw new Error("Failed to initialize LLM with persisted model");
        }

        return {
          llmApi,
          model: selectedModel,
          assistant,
          authConfig,
        };
      }
    } else {
      // Use default model selection
      const [llmApi, model] = getLlmApi(assistant, authConfig);
      return {
        llmApi,
        model,
        assistant,
        authConfig,
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
      // Update instance properties for backward compatibility
      this.assistant = assistant;
      this.authConfig = authConfig;
      this.availableModels = (assistant.models?.filter(
        (model) =>
          model && (model.roles?.includes("chat") || model.roles === undefined),
      ) || []) as ModelConfig[];

      const [llmApi, model] = getLlmApi(assistant, authConfig);

      // Ensure state has all necessary data
      this.setState({
        llmApi,
        model,
        assistant,
        authConfig,
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
    // Get assistant from state to ensure we have the latest data
    const { assistant } = this.getState();
    if (!assistant || !assistant.models) {
      return [];
    }

    // Filter for chat models
    const chatModels = (assistant.models.filter(
      (model) =>
        model && (model.roles?.includes("chat") || model.roles === undefined),
    ) || []) as ModelConfig[];

    return chatModels.map((model, index) => ({
      provider: model.provider,
      name: (model as any).name || (model as any).model || "unnamed",
      index,
    }));
  }

  /**
   * Switch to a different chat model by index
   */
  async switchModel(modelIndex: number): Promise<ModelServiceState> {
    // Get assistant and authConfig from state, but fall back to instance properties
    // This is needed during initialization when state isn't set yet
    const stateValues = this.getState();
    const assistant = stateValues.assistant || this.assistant;
    const authConfig = stateValues.authConfig || this.authConfig;

    // Debug logging to understand the state
    logger.debug("switchModel: Checking state", {
      hasStateAssistant: !!stateValues.assistant,
      hasStateAuthConfig: !!stateValues.authConfig,
      hasInstanceAssistant: !!this.assistant,
      hasInstanceAuthConfig: !!this.authConfig,
      isInitialized: this.isReady(),
      isReady: this.isReady(),
      modelIndex,
    });

    if (!assistant) {
      logger.error("switchModel: Missing assistant data", {
        assistant: !!assistant,
        authConfig: !!authConfig,
        stateKeys: Object.keys(stateValues),
        currentState: {
          hasLlmApi: !!stateValues.llmApi,
          hasModel: !!stateValues.model,
          hasAssistant: !!stateValues.assistant,
          hasAuthConfig: !!stateValues.authConfig,
        },
      });
      throw new Error("ModelService not initialized - assistant data missing");
    }

    // Get available models from assistant in state
    const availableModels = (assistant.models?.filter(
      (model) =>
        model && (model.roles?.includes("chat") || model.roles === undefined),
    ) || []) as ModelConfig[];

    if (modelIndex < 0 || modelIndex >= availableModels.length) {
      throw new Error(
        `Invalid model index: ${modelIndex}. Available models: 0-${availableModels.length - 1}`,
      );
    }

    const selectedModel = availableModels[modelIndex];
    logger.debug("Switching to model", {
      modelIndex,
      provider: selectedModel.provider,
      name: (selectedModel as any).name || "unnamed",
    });

    try {
      const accessToken = getAccessToken(authConfig);
      const organizationId = getOrganizationId(authConfig);

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
                proxyUrl: (selectedModel as any).onPremProxyUrl ?? undefined,
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
        assistant,
        authConfig,
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
    const state = this.getState();
    if (!state.model || !state.assistant) {
      return -1;
    }

    // Get available models from state
    const availableModels = (state.assistant.models?.filter(
      (model) =>
        model && (model.roles?.includes("chat") || model.roles === undefined),
    ) || []) as ModelConfig[];

    return availableModels.findIndex(
      (model) =>
        model.provider === state.model?.provider &&
        (model as any).name === (state.model as any).name,
    );
  }

  /**
   * Get model index by name and provider
   */
  getModelIndexByName(modelName: string, provider?: string): number {
    const state = this.getState();
    if (!state.assistant) {
      return -1;
    }

    // Get available models from state
    const availableModels = (state.assistant.models?.filter(
      (model) =>
        model && (model.roles?.includes("chat") || model.roles === undefined),
    ) || []) as ModelConfig[];

    return availableModels.findIndex((model) => {
      const name = (model as any).name || (model as any).model;
      const nameMatches = name === modelName;

      if (provider) {
        return nameMatches && model.provider === provider;
      }

      return nameMatches;
    });
  }
}
