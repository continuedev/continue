import { SlashCommandDescWithSource } from "core";
import { useState } from "react";
import { useBookmarkedSlashCommands } from "../../hooks/useBookmarkedSlashCommands";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { useMainEditor } from "../mainInput/TipTapEditor";
import { ConversationStarterCard } from "./ConversationStarterCard";

const NUM_CARDS_TO_RENDER = 5;

/**
 * Displays a grid of conversation starter cards for bookmarked slash commands
 */
export function ConversationStarterCards() {
  const dispatch = useAppDispatch();
  const { mainEditor } = useMainEditor();
  const [showAll, setShowAll] = useState(false);
  const { isCommandBookmarked } = useBookmarkedSlashCommands();
  const slashCommands = useAppSelector(
    (state) => state.config.config.slashCommands ?? [],
  );

  const bookmarkedSlashCommands = slashCommands.filter((command) =>
    isCommandBookmarked(command.name),
  );

  function onClick(command: SlashCommandDescWithSource) {
    mainEditor?.commands.insertPrompt({
      description: command.description,
      title: command.name,
      content: command.prompt,
    });
  }

  if (bookmarkedSlashCommands.length === 0) {
    return null;
  }

  const visibleCommands = showAll
    ? bookmarkedSlashCommands
    : bookmarkedSlashCommands.slice(0, NUM_CARDS_TO_RENDER);

  const remainingCount = bookmarkedSlashCommands.length - NUM_CARDS_TO_RENDER;

  return (
    <div className="flex w-full max-w-full flex-col">
      <div className="lg:grid lg:grid-cols-3 lg:gap-4">
        {visibleCommands.map((command, i) => (
          <ConversationStarterCard
            key={command.name + i}
            command={command}
            onClick={onClick}
          />
        ))}
      </div>
      {bookmarkedSlashCommands.length > NUM_CARDS_TO_RENDER && (
        <span
          className="text-lightgray mt-1 cursor-pointer text-xs hover:underline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less" : `Show ${remainingCount} more...`}
        </span>
      )}
    </div>
  );
}
