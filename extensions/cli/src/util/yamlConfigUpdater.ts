import { parseDocument } from "yaml";

export interface ModelConfig {
  uses: string;
  with: {
    ANTHROPIC_API_KEY: string;
  };
}

export interface ConfigStructure {
  name: string;
  version: string;
  schema: string;
  models: ModelConfig[];
}

/**
 * Updates or adds an Anthropic Claude model configuration in a YAML string while preserving comments and formatting.
 * This is a pure function that takes a YAML string and returns a modified YAML string.
 *
 * @param yamlContent - The original YAML content as a string (can be empty)
 * @param apiKey - The Anthropic API key to set
 * @returns The updated YAML content as a string with comments preserved
 */
export function updateAnthropicModelInYaml(
  yamlContent: string,
  apiKey: string,
): string {
  const newModel: ModelConfig = {
    uses: "anthropic/claude-sonnet-4-5",
    with: {
      ANTHROPIC_API_KEY: apiKey,
    },
  };

  try {
    const doc = parseDocument(yamlContent);

    // If document is empty or has no content, create a new config
    if (!doc.contents || doc.contents === null) {
      const defaultConfig: ConfigStructure = {
        name: "Local Config",
        version: "1.0.0",
        schema: "v1",
        models: [newModel],
      };

      const newDoc = parseDocument("");
      Object.keys(defaultConfig).forEach((key) =>
        newDoc.set(key, (defaultConfig as any)[key]),
      );
      return newDoc.toString();
    }

    // Convert to JS, filter models, and recreate
    const config = doc.toJS() as any;

    // Make sure models array exists
    if (!config.models) {
      config.models = [];
    }

    // Filter out existing anthropic models
    config.models = config.models.filter(
      (model: any) => !model || model.uses !== "anthropic/claude-sonnet-4-5",
    );

    // Add the new anthropic model
    config.models.push(newModel);

    // Update the models array while preserving comments and structure
    doc.set("models", config.models);

    return doc.toString();
  } catch {
    // If parsing fails completely, create a new config
    const defaultConfig: ConfigStructure = {
      name: "Local Config",
      version: "1.0.0",
      schema: "v1",
      models: [newModel],
    };

    const doc = parseDocument("");
    Object.keys(defaultConfig).forEach((key) =>
      doc.set(key, (defaultConfig as any)[key]),
    );
    return doc.toString();
  }
}
