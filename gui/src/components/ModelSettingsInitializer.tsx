import { useModelThinkingSettings } from "../hooks/useModelThinkingSettings";

/**
 * This is a "headless" component that initializes model-specific settings.
 * It doesn't render any UI but handles configuration initialization when models change.
 */
export function ModelSettingsInitializer() {
  // Initialize thinking settings when model changes
  useModelThinkingSettings();
  
  // No visible UI - this is a utility component
  return null;
}

export default ModelSettingsInitializer;
