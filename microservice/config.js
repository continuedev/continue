const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ConfigManager {
  constructor() {
    this.configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config.yaml');
    this.config = null;
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = yaml.load(configData);
      return this.config;
    } catch (error) {
      console.warn('Config file not found, using defaults');
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  getDefaultConfig() {
    return {
      models: [
        {
          title: "Claude 4 Sonnet",
          provider: "anthropic",
          model: "claude-3-5-sonnet-20241022",
          apiKey: "",
          contextLength: 200000
        },
        {
          title: "Claude 4.1 Opus", 
          provider: "anthropic",
          model: "claude-3-opus-20240229",
          apiKey: "",
          contextLength: 200000
        },
        {
          title: "DeepSeek V3",
          provider: "deepseek", 
          model: "deepseek-chat",
          apiKey: "",
          contextLength: 64000
        },
        {
          title: "Devstral Medium",
          provider: "mistral",
          model: "codestral-latest", 
          apiKey: "",
          contextLength: 32000
        },
        {
          title: "Devstral Small",
          provider: "mistral", 
          model: "codestral-2405",
          apiKey: "",
          contextLength: 32000
        },
        {
          title: "Gemini 2.5 Pro",
          provider: "google",
          model: "gemini-2.0-flash-exp",
          apiKey: "",
          contextLength: 1048576
        },
        {
          title: "gemma3 4b",
          provider: "ollama",
          model: "gemma2:2b",
          apiKey: "",
          contextLength: 8192
        },
        {
          title: "GPT OSS 120B", 
          provider: "openai-compatible",
          model: "gpt-oss-120b",
          apiKey: "",
          contextLength: 128000
        },
        {
          title: "GPT OSS 20B",
          provider: "openai-compatible", 
          model: "gpt-oss-20b",
          apiKey: "",
          contextLength: 32000
        },
        {
          title: "GPT-5",
          provider: "openai",
          model: "gpt-5",
          apiKey: "",
          contextLength: 200000
        },
        {
          title: "Grok 4",
          provider: "xai",
          model: "grok-4",
          apiKey: "",
          contextLength: 128000
        },
        {
          title: "Kimi K2 Instruct",
          provider: "moonshot",
          model: "moonshot-v1-128k", 
          apiKey: "",
          contextLength: 128000
        },
        {
          title: "Mercury Coder Next Edit",
          provider: "mercury",
          model: "mercury-coder-next-edit",
          apiKey: "",
          contextLength: 32000
        },
        {
          title: "Mercury Coder Small",
          provider: "mercury",
          model: "mercury-coder-small", 
          apiKey: "",
          contextLength: 16000
        }
      ],
      selectedModel: "GPT-5",
      contextProviders: [
        {
          name: "codebase",
          params: {}
        },
        {
          name: "diff", 
          params: {}
        },
        {
          name: "terminal",
          params: {}
        },
        {
          name: "problems",
          params: {}
        },
        {
          name: "folder",
          params: {}
        },
        {
          name: "codeHighlights", 
          params: {}
        }
      ],
      slashCommands: [
        {
          name: "edit",
          description: "Edit code using AI"
        },
        {
          name: "comment", 
          description: "Add comments to code"
        },
        {
          name: "share",
          description: "Share code snippet" 
        },
        {
          name: "cmd",
          description: "Run terminal commands"
        },
        {
          name: "commit",
          description: "Generate commit message"
        }
      ],
      customCommands: [],
      tabAutocompleteModel: {
        title: "Mercury Coder Small",
        provider: "mercury",
        model: "mercury-coder-small"
      },
      embeddingsProvider: {
        provider: "ollama",
        model: "nomic-embed-text",
        apiKey: ""
      },
      rerankerProvider: {
        name: "cohere",
        params: {
          model: "rerank-english-v2.0",
          apiKey: ""
        }
      }
    };
  }

  async saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    const yamlStr = yaml.dump(this.config);
    await fs.writeFile(this.configPath, yamlStr, 'utf8');
    return this.config;
  }
}

const configManager = new ConfigManager();

async function getConfig(req, res) {
  try {
    const config = await configManager.loadConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateConfig(req, res) {
  try {
    const config = await configManager.saveConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getModels(req, res) {
  try {
    const config = await configManager.loadConfig();
    res.json({ success: true, data: config.models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getConfig,
  updateConfig, 
  getModels,
  configManager
};