import { ModelDescription } from "../index.d";

/**
 * Determines if system message tools should be auto-enabled for the given model.
 * This is used to automatically enable system message tools for certain provider/model combinations
 * where we have a strong preference, taking priority over user manual settings.
 *
 * System message tools are an alternative to native tool calling where tool definitions and calls
 * are embedded in the system message as text rather than using the provider's native tool calling API.
 * This can be beneficial for providers/models that don't support native tool calling or have
 * poor tool calling performance.
 *
 * Current auto-enable rules:
 * - OpenRouter provider: true for all models except those containing "claude" (since Claude models
 *   generally have good native tool calling support)
 * - All other providers: undefined (no auto-preference, use manual setting)
 *
 * @param model The model description to check
 * @returns true to force enable, false to force disable, undefined for no auto-preference
 */
export function shouldAutoEnableSystemMessageTools(
  model: ModelDescription,
): boolean | undefined {
  // Auto-enable for OpenRouter, but exclude Claude models which have good native tool calling
  if (model.provider === "openrouter") {
    return !model.model.toLowerCase().includes("claude");
  }

  // No auto-preference for all other providers - use manual setting
  return undefined;
}
