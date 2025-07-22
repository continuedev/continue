import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { getLlmApi } from '../config.js';
import { AuthConfig } from '../auth/workos.js';
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

  /**
   * Initialize the model service
   */
  async initialize(
    assistant: AssistantUnrolled,
    authConfig: AuthConfig
  ): Promise<ModelServiceState> {
    logger.debug('Initializing ModelService');
    
    try {
      const [llmApi, model] = getLlmApi(assistant, authConfig);

      this.currentState = {
        llmApi,
        model
      };

      logger.debug('ModelService initialized successfully', {
        modelProvider: model.provider,
        modelName: (model as any).name || 'unnamed'
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
      const [llmApi, model] = getLlmApi(assistant, authConfig);

      this.currentState = {
        llmApi,
        model
      };

      logger.debug('ModelService updated successfully', {
        modelProvider: model.provider,
        modelName: (model as any).name || 'unnamed'
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
}