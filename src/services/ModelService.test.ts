import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModelService } from './ModelService.js';
import { AssistantUnrolled, ModelConfig } from '@continuedev/config-yaml';
import { AuthConfig } from '../auth/workos.js';

describe('ModelService', () => {
  let modelService: ModelService;
  let mockAssistant: AssistantUnrolled;
  let mockAuthConfig: AuthConfig;

  beforeEach(() => {
    modelService = new ModelService();
    
    mockAssistant = {
      name: 'test-assistant',
      version: '1.0.0',
      models: [
        {
          provider: 'openai',
          model: 'gpt-4',
          name: 'GPT-4',
          apiKey: 'test-key',
          roles: ['chat'],
        } as ModelConfig,
        {
          provider: 'anthropic',
          model: 'claude-3',
          name: 'Claude 3',
          apiKey: 'test-key',
          roles: ['chat'],
        } as ModelConfig,
        {
          provider: 'openai',
          model: 'gpt-3.5',
          name: 'GPT-3.5',
          apiKey: 'test-key',
          roles: ['embed'],
        } as ModelConfig,
      ],
    } as AssistantUnrolled;

    mockAuthConfig = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      userEmail: 'test@example.com',
      userId: 'test-user',
      organizationId: 'test-org',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    };
  });

  describe('getAvailableChatModels', () => {
    it('should return only models with chat role', async () => {
      await modelService.initialize(mockAssistant, mockAuthConfig);
      
      const models = modelService.getAvailableChatModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        provider: 'openai',
        name: 'GPT-4',
        index: 0,
      });
      expect(models[1]).toEqual({
        provider: 'anthropic',
        name: 'Claude 3',
        index: 1,
      });
    });

    it('should throw error when no chat models available during initialization', async () => {
      mockAssistant.models = [
        {
          provider: 'openai',
          model: 'text-embedding-ada-002',
          name: 'Ada Embeddings',
          roles: ['embed'],
        } as ModelConfig,
      ];
      
      await expect(modelService.initialize(mockAssistant, mockAuthConfig))
        .rejects.toThrow('No models with the chat role found in the configured assistant');
    });
  });

  describe('switchModel', () => {
    it('should switch to a different model by index', async () => {
      await modelService.initialize(mockAssistant, mockAuthConfig);
      
      const initialModel = modelService.getModelInfo();
      expect(initialModel?.name).toBe('GPT-4');
      
      await modelService.switchModel(1);
      
      const newModel = modelService.getModelInfo();
      expect(newModel?.name).toBe('Claude 3');
    });

    it('should throw error for invalid model index', async () => {
      await modelService.initialize(mockAssistant, mockAuthConfig);
      
      await expect(modelService.switchModel(5)).rejects.toThrow('Invalid model index: 5');
      await expect(modelService.switchModel(-1)).rejects.toThrow('Invalid model index: -1');
    });

    it('should throw error when service not initialized', async () => {
      await expect(modelService.switchModel(0)).rejects.toThrow('ModelService not initialized');
    });
  });

  describe('getCurrentModelIndex', () => {
    it('should return correct index of current model', async () => {
      await modelService.initialize(mockAssistant, mockAuthConfig);
      
      expect(modelService.getCurrentModelIndex()).toBe(0);
      
      await modelService.switchModel(1);
      expect(modelService.getCurrentModelIndex()).toBe(1);
    });

    it('should return -1 when no model is set', () => {
      expect(modelService.getCurrentModelIndex()).toBe(-1);
    });
  });
});