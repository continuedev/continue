import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useAppSelector } from "../../../../redux/hooks";
import { getFontSize } from "../../../../util";

interface PromptRowProps {
  command: string;
  description: string;
}

function PromptRow({ command, description }: PromptRowProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);

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
  const prompts = useAppSelector((store) => store.config.config.slashCommands);

  return (
    <div className="flex flex-col gap-1 pr-2">
      {prompts?.map((prompt) => (
        <PromptRow
          key={prompt.name}
          command={prompt.name}
          description={prompt.description}
        />
      ))}
    </div>
  );
}
