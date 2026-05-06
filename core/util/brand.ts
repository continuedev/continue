/**
 * Single source of truth for product-identity values used at runtime.
 * See NAMING.md for the full spec.
 *
 * Keep this module dependency-free so it can be imported from any layer.
 */

export const BRAND = {
  /** Display name for UI surfaces. */
  DISPLAY_NAME: "Yuto Agentic",

  /** Slug used in package and identifier roots. */
  SLUG: "yutoagentic",

  /** Global config directory (under the user's home). */
  GLOBAL_DIR_NAME: ".yutoagentic",

  /** Env var that overrides the global config directory. */
  GLOBAL_DIR_ENV: "YUTOAGENTIC_GLOBAL_DIR",

  /** Per-workspace files. */
  IGNORE_FILE: ".yutoagenticignore",
  RC_FILE: ".yutoagenticrc.json",

  /**
   * Legacy values kept only so the one-time migration prompt can detect
   * pre-rebrand installations (see Phase 10). Never use these as primary
   * identifiers in new code.
   */
  LEGACY: {
    GLOBAL_DIR_NAME: ".continue",
    GLOBAL_DIR_ENV: "CONTINUE_GLOBAL_DIR",
    IGNORE_FILE: ".continueignore",
    RC_FILE: ".continuerc.json",
  },
} as const;
