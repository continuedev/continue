import { AssistantUnrolled } from "@continuedev/config-yaml";

export type AssistantConfig = AssistantUnrolled;

/**
 * Class that wraps an assistant configuration with utility methods
 */
export class Assistant {
  /**
   * The assistant configuration object
   */
  config: AssistantConfig;

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
  getModel(modelName?: string): string {
    const firstModel = this.config?.models?.[0];

    if (!this.config.models || !firstModel) {
      throw new Error("No models available in assistant configuration");
    }

    if (!modelName) {
      return firstModel.model;
    }

    // Look for a model matching the provided name
    const model = this.config.models.find(
      (m) =>
        m?.model === modelName ||
        m?.model.includes(modelName) ||
        m?.model.endsWith(`/${modelName}`),
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

    return this.config.rules
      ?.filter((rule) => !!rule)
      .map((rule) => (typeof rule === "string" ? rule : rule?.rule))
      .join("\n");
  }
}
