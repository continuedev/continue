import { SlashCommandDescription } from "core";
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

  // Function to toggle bookmark status
  const toggleBookmark = (command: SlashCommandDescription) => {
    const isBookmarked = bookmarkStatuses[command.name];

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
