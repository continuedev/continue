import { SlashCommandDescription } from "core";
import { useAppDispatch } from "../../redux/hooks";
import { setMainEditorContentTrigger } from "../../redux/slices/sessionSlice";
import { getParagraphNodeFromString } from "../mainInput/utils";
import { ConversationStarterCard } from "./ConversationStarterCard";
import { useBookmarkedSlashCommands } from "./useBookmarkedSlashCommands";

const NUM_CARDS_TO_RENDER = 3;

export function ConversationStarterCards() {
  const dispatch = useAppDispatch();
  const { cmdsSortedByBookmark, bookmarkStatuses, toggleBookmark } =
    useBookmarkedSlashCommands();

  function onClick(command: SlashCommandDescription) {
    if (command.prompt) {
      dispatch(
        setMainEditorContentTrigger(getParagraphNodeFromString(command.prompt)),
      );
    }
  }

  if (!cmdsSortedByBookmark || cmdsSortedByBookmark.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-full flex-col lg:grid lg:grid-cols-3 lg:gap-4">
      {cmdsSortedByBookmark.slice(0, NUM_CARDS_TO_RENDER).map((command, i) => (
        <ConversationStarterCard
          key={command.name + i}
          command={command}
          onClick={onClick}
          onBookmark={() => toggleBookmark(command)}
          isBookmarked={bookmarkStatuses[command.name]}
        />
      ))}
    </div>
  );
}
