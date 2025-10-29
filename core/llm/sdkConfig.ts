/**
 * Central configuration for SDK-specific settings
 * This is the single source of truth for SDK name used across all system messages
 */
export const SDK_CONFIG = {
  /**
   * The name of the SDK to be used in system messages
   * This value will replace all {{SDK_NAME}} placeholders in system message templates
   */
  SDK_NAME: "Flexprice",
} as const;

export type SdkConfig = typeof SDK_CONFIG;
