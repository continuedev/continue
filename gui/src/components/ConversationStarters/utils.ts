import { SlashCommandDescription } from "core";

const DEPRECATED_SLASH_COMMAND_NAMES = ["share", "cmd"];

/**
 * The commands filtered here are currently inserted into the slash commands array during
 * intermediary config loading, but once we get the actual prompts for an assistant,
 * they are overwritten.
 *
 * If we don't manually filter them out, then they are displayed in the UI
 * while the assistant is still loading.
 *
 * Once these commands are no longer inserted during intermediary config loading,
 * this function can be removed.
 */
export function isDeprecatedCommandName(command: SlashCommandDescription) {
  return !DEPRECATED_SLASH_COMMAND_NAMES.includes(command.name);
}
