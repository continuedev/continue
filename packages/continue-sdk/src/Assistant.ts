import { AssistantUnrolled } from "@continuedev/config-yaml";

/**
 * Class that wraps an assistant configuration with utility methods
 */
export class Assistant {
  /**
   * The assistant configuration object
   */
  config: AssistantUnrolled;

  /**
   * Create a new Assistant instance
   *
   * @param config - The raw assistant configuration
   */
  constructor(config: any) {
    this.config = config;
  }

  /**
   * Get a model from the assistant by name
   *
   * @param modelName - The name of the model to find
   * @returns The model configuration or the first model if no name is provided
   */
  getModel(modelName: string): any {
    if (!this.config.models || !this.config.models.length) {
      throw new Error("No models available in assistant configuration");
    }

    // Look for a model matching the provided name
    const model = this.config.models.find(
      (m: any) =>
        m.model === modelName ||
        m.model.includes(modelName) ||
        m.model.endsWith(`/${modelName}`),
    );

    if (!model) {
      throw new Error(
        `Model ${modelName} not found in assistant configuration`,
      );
    }

    return model.model;
  }

  /**
   * Get the system message from the assistant rules
   *
   * @returns The concatenated rules as a single string
   */
  get systemMessage(): string {
    if (!this.config.rules || !Array.isArray(this.config.rules)) {
      return "";
    }

    return this.config.rules.join("\n");
  }
}
