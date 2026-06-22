import { SlashCommandDescWithSource } from "core";
<<<<<<< HEAD
import { usePostHog } from "posthog-js/react";
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  bookmarkSlashCommand,
  selectBookmarkedSlashCommands,
  unbookmarkSlashCommand,
} from "../redux/slices/profilesSlice";

export function useBookmarkedSlashCommands() {
  const dispatch = useAppDispatch();
<<<<<<< HEAD
  const posthog = usePostHog();
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  const bookmarkedCommands = useAppSelector(selectBookmarkedSlashCommands);

  const isCommandBookmarked = (commandName: string): boolean => {
    return bookmarkedCommands.includes(commandName);
  };

  const toggleBookmark = (command: SlashCommandDescWithSource) => {
    const isBookmarked = isCommandBookmarked(command.name);

<<<<<<< HEAD
    posthog.capture("toggle_bookmarked_slash_command", {
      isBookmarked,
    });

=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
