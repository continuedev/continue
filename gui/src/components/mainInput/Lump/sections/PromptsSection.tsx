import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { getFontSize } from "../../../../util";
import { useBookmarkedSlashCommands } from "../../../ConversationStarters/useBookmarkedSlashCommands";

interface PromptRowProps {
  command: string;
  description: string;
  isBookmarked: boolean;
  setIsBookmarked: (isBookmarked: boolean) => void;
}

function PromptRow({
  command,
  description,
  isBookmarked,
  setIsBookmarked,
}: PromptRowProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        fontSize: `${getFontSize() - 3}px`,
      }}
    >
      <div className="flex min-w-0 gap-2">
        <span className="text-vscForeground shrink-0">{command}</span>
        <span className="truncate text-gray-400">{description}</span>
      </div>
      <div
        onClick={() => setIsBookmarked(!isBookmarked)}
        className="cursor-pointer"
      >
        {isBookmarked ? (
          <BookmarkSolid className="h-3 w-3" />
        ) : (
          <BookmarkOutline className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}

export function PromptsSection() {
  const { cmdsSortedByBookmark, bookmarkStatuses, toggleBookmark } =
    useBookmarkedSlashCommands();

  return (
    <div className="flex flex-col gap-1 pr-2">
      {cmdsSortedByBookmark?.map((prompt, i) => (
        <PromptRow
          key={prompt.name}
          command={prompt.name}
          description={prompt.description}
          isBookmarked={bookmarkStatuses[prompt.name]}
          setIsBookmarked={() => toggleBookmark(prompt)}
        />
      ))}
    </div>
  );
}
