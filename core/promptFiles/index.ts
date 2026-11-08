import { ContextProviderName } from "..";

export const DEFAULT_PROMPTS_FOLDER_V1 = ".prompts";
export const DEFAULT_PROMPTS_FOLDER_V2 = ".continuous/prompts";
export const DEFAULT_RULES_FOLDER = ".continuous/rules";
// Read too: the folders before 2.4.2
export const LEGACY_PROMPTS_FOLDER = ".continue/prompts";
export const LEGACY_RULES_FOLDER = ".continue/rules";

// Subdirectory names (without the .continuous/ prefix)
export const RULES_DIR_NAME = "rules";
export const PROMPTS_DIR_NAME = "prompts";

export const SUPPORTED_PROMPT_CONTEXT_PROVIDERS: ContextProviderName[] = [
  "file",
  "clipboard",
  "repo-map",
  "currentFile",
  "os",
  "problems",
  "codebase",
  "tree",
  "open",
  "debugger",
  "terminal",
  "diff",
];
