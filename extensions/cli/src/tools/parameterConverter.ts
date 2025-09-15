/**
 * Converts tool parameters to JSON Schema format.
 * Handles nested properties and converts required booleans to required arrays.
 */
export function convertToolParametersToJsonSchema(
  parameters: Record<string, any>,
): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(parameters)) {
    const schema: any = {
      type: param.type,
      description: param.description,
    };

    // Add this key to required array if it's required
    if (param.required) {
      required.push(key);
    }

    // Handle array items
    if (param.items) {
      schema.items = convertItemsToJsonSchema(param.items);
    }

    // Handle object properties (nested properties)
    if (param.properties) {
      const nestedSchema = convertToolParametersToJsonSchema(param.properties);
      schema.properties = nestedSchema.properties;
      if (nestedSchema.required?.length > 0) {
        schema.required = nestedSchema.required;
      }
    }

    properties[key] = schema;
  }

  const result: any = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  return result;
}

/**
 * Converts items schema to JSON Schema format
 */
function convertItemsToJsonSchema(items: any): any {
  const itemSchema: any = {
    type: items.type,
  };

  if (items.description) {
    itemSchema.description = items.description;
  }

  // Handle nested properties in items
  if (items.properties) {
    const nestedSchema = convertToolParametersToJsonSchema(items.properties);
    itemSchema.properties = nestedSchema.properties;
    if (nestedSchema.required?.length > 0) {
      itemSchema.required = nestedSchema.required;
    }
  }

  // Handle nested items (for arrays of arrays)
  if (items.items) {
    itemSchema.items = convertItemsToJsonSchema(items.items);
  }

  return itemSchema;
}