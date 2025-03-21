import { SlashCommandDescription } from "core";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setMainEditorContentTrigger } from "../../redux/slices/sessionSlice";
import { getParagraphNodeFromString } from "../mainInput/utils";
import { ConversationStarterCard } from "./ConversationStarterCard";
import { isDeprecatedCommandName } from "./utils";

const NUM_CARDS_TO_RENDER_COLLAPSED = 3;

export function ConversationStarterCards() {
  const dispatch = useAppDispatch();
  const [bookmarkedCommands, setBookmarkedCommands] = useState<string[]>([]);

  const slashCommands =
    useAppSelector((state) => state.config.config.slashCommands) ?? [];

  const filteredSlashCommands = slashCommands?.filter(isDeprecatedCommandName);

  function onClick(command: SlashCommandDescription) {
    if (command.prompt) {
      dispatch(
        setMainEditorContentTrigger(getParagraphNodeFromString(command.prompt)),
      );
    }
  }

  function handleBookmarkCommand(command: SlashCommandDescription) {
    setBookmarkedCommands((prev) => {
      if (prev.includes(command.name)) {
        return prev.filter((name) => name !== command.name);
      } else {
        return [...prev, command.name];
      }
    });
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
            isBookmarked={bookmarkedCommands.includes(command.name)}
          />
        ))}
    </div>
  );
}
