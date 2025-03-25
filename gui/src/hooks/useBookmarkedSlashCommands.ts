import { SlashCommandDescription } from "core";
import { usePostHog } from "posthog-js/react";
import {
  bookmarkSlashCommand,
  selectBookmarkedSlashCommands,
  unbookmarkSlashCommand,
} from "../redux";
import { useAppDispatch, useAppSelector } from "../redux/hooks";

export function useBookmarkedSlashCommands() {
  const dispatch = useAppDispatch();
  const posthog = usePostHog();
  const bookmarkedCommands = useAppSelector(selectBookmarkedSlashCommands);

  const isCommandBookmarked = (commandName: string): boolean => {
    return bookmarkedCommands.includes(commandName);
  };

  const toggleBookmark = (command: SlashCommandDescription) => {
    const isBookmarked = isCommandBookmarked(command.name);

    posthog.capture("toggle_bookmarked_slash_command", {
      isBookmarked,
    });

    if (isBookmarked) {
      dispatch(
        unbookmarkSlashCommand({
          commandName: command.name,
        }),
      );
    } else {
      dispatch(
        bookmarkSlashCommand({
          commandName: command.name,
        }),
      );
    }
  };

  return {
    isCommandBookmarked,
    toggleBookmark,
  };
}
