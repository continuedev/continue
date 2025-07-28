import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi, constructLlmApi, LLMConfig } from "@continuedev/openai-adapters";
import { getLlmApi } from '../config.js';
import { AuthConfig, getAccessToken, getOrganizationId, getModelName } from '../auth/workos.js';
import logger from '../util/logger.js';
import { ModelServiceState } from './types.js';

/**
 * Service for managing LLM and model state
 * Depends on auth config and assistant config
 */
export class ModelService {
  private currentState: ModelServiceState = {
    llmApi: null,
    model: null
  };
  private availableModels: ModelConfig[] = [];
  private assistant: AssistantUnrolled | null = null;
  private authConfig: AuthConfig | null = null;

  /**
   * Initialize the model service
   */
  async initialize(
    assistant: AssistantUnrolled,
    authConfig: AuthConfig
  ): Promise<ModelServiceState> {
    logger.debug('Initializing ModelService');
    
    try {
      this.assistant = assistant;
      this.authConfig = authConfig;
      this.availableModels = (assistant.models?.filter((model) => 
        model && model.roles?.includes("chat")
      ) || []) as ModelConfig[];
      
      // Check if we have a persisted model name and use it if valid
      const persistedModelName = getModelName(authConfig);
      if (persistedModelName) {
        const modelIndex = this.getModelIndexByName(persistedModelName);
        if (modelIndex !== -1) {
          // Use the persisted model
          const state = await this.switchModel(modelIndex);
          this.currentState = state;
        } else {
          // Model name not found, use default model selection
          const [llmApi, model] = getLlmApi(assistant, authConfig);
          this.currentState = {
            llmApi,
            model
          };
        }
      } else {
        // Use default model selection
        const [llmApi, model] = getLlmApi(assistant, authConfig);
        this.currentState = {
          llmApi,
          model
        };
      }

      logger.debug('ModelService initialized successfully', {
        modelProvider: this.currentState.model?.provider,
        modelName: (this.currentState.model as any)?.name || 'unnamed',
        availableModels: this.availableModels.length
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to initialize ModelService:', error);
      throw error;
    }
  }

  /**
   * Get current model state
   */
  getState(): ModelServiceState {
    return { ...this.currentState };
  }

  /**
   * Update the model based on new config or auth changes
   */
  async update(
    assistant: AssistantUnrolled,
    authConfig: AuthConfig
  ): Promise<ModelServiceState> {
    logger.debug('Updating ModelService');
    
    try {
      this.assistant = assistant;
      this.authConfig = authConfig;
      this.availableModels = (assistant.models?.filter((model) => 
        model && model.roles?.includes("chat")
      ) || []) as ModelConfig[];
      
      const [llmApi, model] = getLlmApi(assistant, authConfig);

      this.currentState = {
        llmApi,
        model
      };

      logger.debug('ModelService updated successfully', {
        modelProvider: model.provider,
        modelName: (model as any).name || 'unnamed',
        availableModels: this.availableModels.length
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to update ModelService:', error);
      throw error;
    }
  }

  /**
   * Check if the current model is ready for use
   */
  isReady(): boolean {
    return this.currentState.llmApi !== null && this.currentState.model !== null;
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
      name: (this.currentState.model as any).name || 'unnamed'
    };
  }

  /**
   * Get list of available chat models
   */
  getAvailableChatModels(): Array<{ provider: string; name: string; index: number }> {
    return this.availableModels.map((model, index) => ({
      provider: model.provider,
      name: (model as any).name || (model as any).model || 'unnamed',
      index
    }));
  }

  /**
   * Switch to a different chat model by index
   */
  async switchModel(modelIndex: number): Promise<ModelServiceState> {
    if (!this.assistant || !this.authConfig) {
      throw new Error('ModelService not initialized');
    }

    if (modelIndex < 0 || modelIndex >= this.availableModels.length) {
      throw new Error(`Invalid model index: ${modelIndex}. Available models: 0-${this.availableModels.length - 1}`);
    }

    const selectedModel = this.availableModels[modelIndex];
    logger.debug('Switching to model', {
      modelIndex,
      provider: selectedModel.provider,
      name: (selectedModel as any).name || 'unnamed'
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
        throw new Error('Failed to initialize LLM with selected model');
      }

      this.currentState = {
        llmApi,
        model: selectedModel
      };

      logger.debug('Model switched successfully', {
        modelProvider: selectedModel.provider,
        modelName: (selectedModel as any).name || 'unnamed'
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to switch model:', error);
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

    return this.availableModels.findIndex(model => 
      model.provider === this.currentState.model?.provider &&
      (model as any).name === (this.currentState.model as any).name
    );
  }

  /**
   * Get model index by name
   */
  getModelIndexByName(modelName: string): number {
    return this.availableModels.findIndex(model => 
      (model as any).name === modelName
    );
  }
}