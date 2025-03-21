import { SlashCommandDescription } from "core";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  bookmarkSlashCommand,
  selectBookmarkedSlashCommands,
  selectSelectedProfileId,
  unbookmarkSlashCommand,
} from "../../redux/slices/profiles/slice";
import { setMainEditorContentTrigger } from "../../redux/slices/sessionSlice";
import { getParagraphNodeFromString } from "../mainInput/utils";
import { ConversationStarterCard } from "./ConversationStarterCard";
import { isDeprecatedCommandName } from "./utils";

const NUM_CARDS_TO_RENDER_COLLAPSED = 3;

export function ConversationStarterCards() {
  const dispatch = useAppDispatch();

  const slashCommands =
    useAppSelector((state) => state.config.config.slashCommands) ?? [];

  const selectedProfileId = useAppSelector(selectSelectedProfileId);
  const bookmarkedCommands = useAppSelector(selectBookmarkedSlashCommands);

  const filteredSlashCommands = slashCommands.filter(isDeprecatedCommandName);

  const bookmarkStatuses: Record<string, boolean> = {};
  if (selectedProfileId) {
    filteredSlashCommands.forEach((command) => {
      bookmarkStatuses[command.name] = bookmarkedCommands.includes(
        command.name,
      );
    });
  }

  function onClick(command: SlashCommandDescription) {
    if (command.prompt) {
      dispatch(
        setMainEditorContentTrigger(getParagraphNodeFromString(command.prompt)),
      );
    }
  }

  function handleBookmarkCommand(command: SlashCommandDescription) {
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
  }
  if (!filteredSlashCommands || filteredSlashCommands.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-full flex-col lg:grid lg:grid-cols-3 lg:gap-4">
      {filteredSlashCommands
        .slice(0, NUM_CARDS_TO_RENDER_COLLAPSED)
        .map((command, i) => (
          <ConversationStarterCard
            key={command.name + i}
            command={command}
            onClick={onClick}
            onBookmark={handleBookmarkCommand}
            isBookmarked={bookmarkStatuses[command.name]}
          />
        ))}
    </div>
  );
}
