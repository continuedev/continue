/**
 * Generic model ID to hub slug mapping.
 * These allow users to specify simplified model IDs in agent files
 * that get resolved to their full hub package slugs.
 */

interface GenericModelDefinition {
  id: string;
  displayName: string;
  provider: string;
  description: string;
  currentModelPackageSlug: string;
}

const GENERIC_MODELS: readonly GenericModelDefinition[] = [
  {
    id: "claude-opus",
    displayName: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Most capable, best for complex tasks",
    currentModelPackageSlug: "anthropic/claude-opus-4-5",
  },
  {
    id: "claude-sonnet",
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Balanced performance and speed",
    currentModelPackageSlug: "anthropic/claude-sonnet-4-5",
  },
  {
    id: "claude-haiku",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient",
    currentModelPackageSlug: "anthropic/claude-haiku-4-5",
  },
];

/**
 * Resolve a generic model ID to its current package slug.
 * If the model is already a valid slug (contains "/"), returns it unchanged.
 * If it's a generic ID, resolves to the full package slug.
 * Returns the original value if not recognized (to allow hub slugs to pass through).
 */
export function resolveModelSlug(modelId: string): string {
  // If it already looks like a hub slug (contains "/"), return as-is
  if (modelId.includes("/")) {
    return modelId;
  }

  // Try to find a matching generic model
  const genericModel = GENERIC_MODELS.find((m) => m.id === modelId);
  if (genericModel) {
    return genericModel.currentModelPackageSlug;
  }

  // Return original value - loadModelFromHub will handle validation
  return modelId;
}

/**
 * Check if a model ID is a known generic model ID
 */
export function isGenericModelId(modelId: string): boolean {
  return GENERIC_MODELS.some((m) => m.id === modelId);
}

/**
 * Get all available generic models
 */
export function getAllGenericModels(): readonly GenericModelDefinition[] {
  return GENERIC_MODELS;
}
