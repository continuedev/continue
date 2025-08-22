const axios = require('axios');
const { configManager } = require('./config');

class LLMManager {
  constructor() {
    this.providers = {
      openai: this.createOpenAIProvider,
      anthropic: this.createAnthropicProvider,
      google: this.createGoogleProvider,
      ollama: this.createOllamaProvider,
      deepseek: this.createDeepSeekProvider,
      mistral: this.createMistralProvider,
      xai: this.createXAIProvider,
      moonshot: this.createMoonshotProvider,
      mercury: this.createMercuryProvider,
      'openai-compatible': this.createOpenAICompatibleProvider
    };
  }

  async getModelConfig(modelTitle) {
    const config = await configManager.loadConfig();
    return config.models.find(m => m.title === modelTitle);
  }

  createOpenAIProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      },

      async complete(prompt, options = {}) {
        const response = await axios.post('https://api.openai.com/v1/completions', {
          model: model.model,
          prompt,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createAnthropicProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: model.model,
          messages,
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.7,
          stream: options.stream || false
        }, {
          headers: {
            'x-api-key': model.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createGoogleProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${model.apiKey}`, {
          contents: messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxTokens || 4000
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createOllamaProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('http://localhost:11434/api/chat', {
          model: model.model,
          messages,
          stream: options.stream || false,
          options: {
            temperature: options.temperature || 0.7,
            num_predict: options.maxTokens || 4000
          }
        });
        
        return response.data;
      }
    };
  }

  createDeepSeekProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createMistralProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.mistral.ai/v1/chat/completions', {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createXAIProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.x.ai/v1/chat/completions', {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createMoonshotProvider(model) {
    return {
      async chat(messages, options = {}) {
        const response = await axios.post('https://api.moonshot.cn/v1/chat/completions', {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  createMercuryProvider(model) {
    return {
      async chat(messages, options = {}) {
        // Mock Mercury provider - would use actual Mercury API
        return {
          id: 'mercury-' + Date.now(),
          object: 'chat.completion',
          created: Date.now(),
          model: model.model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock response from Mercury provider.'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        };
      }
    };
  }

  createOpenAICompatibleProvider(model) {
    return {
      async chat(messages, options = {}) {
        const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
        const response = await axios.post(`${baseUrl}/chat/completions`, {
          model: model.model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: options.stream || false
        }, {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.data;
      }
    };
  }

  async getProvider(modelTitle) {
    const model = await this.getModelConfig(modelTitle);
    if (!model) {
      throw new Error(`Model not found: ${modelTitle}`);
    }

    const providerFactory = this.providers[model.provider];
    if (!providerFactory) {
      throw new Error(`Provider not supported: ${model.provider}`);
    }

    return providerFactory.call(this, model);
  }
}

const llmManager = new LLMManager();

async function chat(req, res) {
  try {
    const { modelTitle, messages, options } = req.body;
    const config = await configManager.loadConfig();
    const selectedModel = modelTitle || config.selectedModel;
    
    const provider = await llmManager.getProvider(selectedModel);
    const result = await provider.chat(messages, options);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function complete(req, res) {
  try {
    const { modelTitle, prompt, options } = req.body;
    const config = await configManager.loadConfig();
    const selectedModel = modelTitle || config.selectedModel;
    
    const provider = await llmManager.getProvider(selectedModel);
    
    if (provider.complete) {
      const result = await provider.complete(prompt, options);
      res.json({ success: true, data: result });
    } else {
      // Fallback to chat for providers that don't support completion
      const messages = [{ role: 'user', content: prompt }];
      const result = await provider.chat(messages, options);
      res.json({ success: true, data: result });
    }
  } catch (error) {
    console.error('Complete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAvailableModels(req, res) {
  try {
    const config = await configManager.loadConfig();
    const models = config.models.map(model => ({
      title: model.title,
      provider: model.provider,
      model: model.model,
      contextLength: model.contextLength,
      hasApiKey: !!model.apiKey
    }));
    
    res.json({ success: true, data: models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  chat,
  complete,
  getAvailableModels,
  llmManager
};