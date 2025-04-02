import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/**
 * Inception Labs provider
 * 
 * Integrates with Inception Labs' OpenAI-compatible API endpoints.
 * Provides access to Mercury models for autocomplete and other tasks.
 * 
 * Different models use different API endpoints:
 * - mercury-editor-mini-experimental: zaragoza.api.inceptionlabs.ai
 * - mercury-editor-small-experimental: copenhagen.api.inceptionlabs.ai
 * 
 * More information at: https://docs.inceptionlabs.ai/
 */
class InceptionLabs extends OpenAI {
  static providerName = "inceptionlabs";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://copenhagen.api.inceptionlabs.ai/v1/",
    model: "mercury-editor-small-experimental",
    completionOptions: {
      temperature: 0.0,
      maxTokens: 150,
      presencePenalty: 1.5,
      stop: ["\n\n", "\n \n", "<|endoftext|>"],
      model: "mercury-editor-small-experimental" // Added model to fix TypeScript error
    }
  };

  // Model information including the appropriate API endpoint
  private modelInfo: Record<string, { name: string, apiBase: string }> = {
    // Maps friendly names to model info
    "mercury-mini": {
      name: "mercury-editor-mini-experimental",
      apiBase: "https://zaragoza.api.inceptionlabs.ai/v1/"
    },
    "mercury-small": {
      name: "mercury-editor-small-experimental",
      apiBase: "https://copenhagen.api.inceptionlabs.ai/v1/"
    },
  };

  constructor(options: LLMOptions) {
    super(options);
    
    // Handle model name mapping and set appropriate API base
    const friendlyName = Object.keys(this.modelInfo).find(
      key => options.model === key || options.model === this.modelInfo[key].name
    );
    
    if (friendlyName) {
      // If we found a match in our model info
      const info = this.modelInfo[friendlyName];
      this.model = info.name;
      
      // Only override apiBase if not explicitly provided in options
      if (!options.apiBase) {
        this.apiBase = info.apiBase;
      }
    } else if (options.model === "mercury-editor-mini-experimental") {
      // Handle direct model names not mapped through friendly names
      if (!options.apiBase) {
        this.apiBase = "https://zaragoza.api.inceptionlabs.ai/v1/";
      }
    } else if (options.model === "mercury-editor-small-experimental") {
      if (!options.apiBase) {
        this.apiBase = "https://copenhagen.api.inceptionlabs.ai/v1/";
      }
    }
  }

  async listModels(): Promise<string[]> {
    // For Inception Labs, we'll just return the models we know about
    // since each endpoint only returns its own models
    return Object.values(this.modelInfo).map(info => info.name);
  }

  /**
   * Override the headers to make sure we're using the correct API key format
   */
  protected _getHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "api-key": this.apiKey ?? "", // Added to match the parent class signature
    };
  }
}

export default InceptionLabs;