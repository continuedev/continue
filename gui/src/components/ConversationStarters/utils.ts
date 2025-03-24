import { SlashCommandDescription } from "core";
import {
  defaultSlashCommandsJetBrains,
  defaultSlashCommandsVscode,
} from "core/config/default";
import { isJetBrains } from "../../util";

/**
 * The commands filtered here are currently inserted into the slash commands array during
 * intermediary config loading, but once we get the actual prompts for an assistant,
 * they are overwritten.
 *
 * Additionally, these default commands are all deprecated.
 *
 * If we don't manually filter them out, then they are displayed in the UI
 * while the assistant is still loading.
 *
 * Once these commands are no longer inserted during intermediary config loading,
 * this function can be removed.
 */
export function isDeprecatedCommandName(command: SlashCommandDescription) {
  const defaultCommands = isJetBrains()
    ? defaultSlashCommandsJetBrains
    : defaultSlashCommandsVscode;

  return !defaultCommands.find(
    (defaultCommand) => defaultCommand.name === command.name,
  );
}

/**
 * Sorts commands with bookmarked ones first
 * @param commands The list of commands to sort
 * @param bookmarkedCommands An array of bookmarked command names
 * @returns A new sorted array with bookmarked commands first
 */
export function sortCommandsByBookmarkStatus(
  commands: SlashCommandDescription[],
  bookmarkedCommands: string[],
): SlashCommandDescription[] {
  return [...commands].sort((a, b) => {
    const aIsBookmarked = bookmarkedCommands.includes(a.name);
    const bIsBookmarked = bookmarkedCommands.includes(b.name);

    if (aIsBookmarked && !bIsBookmarked) return -1;
    if (!aIsBookmarked && bIsBookmarked) return 1;
    return 0;
  });
}
