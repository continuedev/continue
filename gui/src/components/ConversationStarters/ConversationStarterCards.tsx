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
  const [isExpanded, setIsExpanded] = useState(false);
  const slashCommands =
    useAppSelector((state) => state.config.config.slashCommands) ?? [];

  const filteredSlashCommands = slashCommands?.filter(isDeprecatedCommandName);

  const numFilteredSlashCommands = filteredSlashCommands.length;
  const displayedCommands = isExpanded
    ? filteredSlashCommands
    : filteredSlashCommands.slice(0, NUM_CARDS_TO_RENDER_COLLAPSED);
  const hasMoreCommands =
    numFilteredSlashCommands > NUM_CARDS_TO_RENDER_COLLAPSED;

  function onClick(command: SlashCommandDescription) {
    if (command.prompt) {
      dispatch(
        setMainEditorContentTrigger(getParagraphNodeFromString(command.prompt)),
      );
    }
  }

  function handleToggleExpand() {
    setIsExpanded(!isExpanded);
  }

  if (!filteredSlashCommands || filteredSlashCommands.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center">
      <h4 className="mb-2 w-full max-w-md self-start">Prompts</h4>

      <div className="w-full max-w-md">
        {displayedCommands.map((command, i) => (
          <ConversationStarterCard
            key={command.name + i}
            command={command}
            onClick={onClick}
          />
        ))}
      </div>

      {hasMoreCommands && (
        <p
          onClick={handleToggleExpand}
          className="text-lightgray cursor-pointer self-start text-xs hover:underline"
        >
          {isExpanded
            ? "Show less"
            : `Show ${numFilteredSlashCommands - NUM_CARDS_TO_RENDER_COLLAPSED} more...`}
        </p>
      )}
    </div>
  );
}
