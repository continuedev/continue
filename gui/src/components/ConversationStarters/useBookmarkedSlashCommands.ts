import { SlashCommandDescription } from "core";
import { usePostHog } from "posthog-js/react";
import { useMemo } from "react";
import {
  bookmarkSlashCommand,
  selectBookmarkedSlashCommands,
  selectSelectedProfileId,
  unbookmarkSlashCommand,
} from "../../redux";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { isDeprecatedCommandName, sortCommandsByBookmarkStatus } from "./utils";

export function useBookmarkedSlashCommands() {
  const dispatch = useAppDispatch();
  const posthog = usePostHog();

  const slashCommands =
    useAppSelector((state) => state.config.config.slashCommands) ?? [];
  const selectedProfileId = useAppSelector(selectSelectedProfileId);
  const bookmarkedCommands = useAppSelector(selectBookmarkedSlashCommands);

  const filteredSlashCommands = slashCommands.filter(isDeprecatedCommandName);

  // Create a map of command names to bookmark status
  const bookmarkStatuses = useMemo(() => {
    const statuses: Record<string, boolean> = {};
    if (selectedProfileId) {
      filteredSlashCommands.forEach((command) => {
        statuses[command.name] = bookmarkedCommands.includes(command.name);
      });
    }
    return statuses;
  }, [filteredSlashCommands, bookmarkedCommands, selectedProfileId]);

  // Sort commands by bookmark status
  const cmdsSortedByBookmark = useMemo(
    () =>
      sortCommandsByBookmarkStatus(filteredSlashCommands, bookmarkedCommands),
    [filteredSlashCommands, bookmarkedCommands],
  );

  const toggleBookmark = (command: SlashCommandDescription) => {
    const isBookmarked = bookmarkStatuses[command.name];

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
    cmdsSortedByBookmark,
    bookmarkStatuses,
    toggleBookmark,
  };
}
