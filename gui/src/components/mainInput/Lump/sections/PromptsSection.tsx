import {
  BookmarkIcon as BookmarkOutline,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { fontSize } from "../../../../util";
import { useBookmarkedSlashCommands } from "../../../ConversationStarters/useBookmarkedSlashCommands";
import { AddBlockButton } from "./AddBlockButton";

interface PromptRowProps {
  command: string;
  description: string;
  isBookmarked: boolean;
  setIsBookmarked: (isBookmarked: boolean) => void;
  onEdit?: () => void;
}

function PromptRow({
  command,
  description,
  isBookmarked,
  setIsBookmarked,
  onEdit,
}: PromptRowProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        fontSize: fontSize(-3),
      }}
    >
      <div className="flex min-w-0 gap-2">
        <span className="text-vscForeground shrink-0">{command}</span>
        <span className="truncate text-gray-400">{description}</span>
      </div>
      <div className="flex items-center gap-2">
        <PencilIcon
          className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
          onClick={onEdit}
        />
        <div
          onClick={() => setIsBookmarked(!isBookmarked)}
          className="cursor-pointer pt-0.5 text-gray-400"
        >
          {isBookmarked ? (
            <BookmarkSolid className="h-3 w-3" />
          ) : (
            <BookmarkOutline className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}

export function PromptsSection() {
  const { cmdsSortedByBookmark, bookmarkStatuses, toggleBookmark } =
    useBookmarkedSlashCommands();

  const handleEdit = (prompt: any) => {
    // Handle edit action here
    console.log("Editing prompt:", prompt);
  };

  return (
    <div className="flex flex-col gap-1">
      {cmdsSortedByBookmark?.map((prompt, i) => (
        <PromptRow
          key={prompt.name}
          command={prompt.name}
          description={prompt.description}
          isBookmarked={bookmarkStatuses[prompt.name]}
          setIsBookmarked={() => toggleBookmark(prompt)}
          onEdit={() => handleEdit(prompt)}
        />
      ))}
      <AddBlockButton blockType="prompts" />
    </div>
  );
}
