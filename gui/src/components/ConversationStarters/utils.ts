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
