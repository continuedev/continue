import { BookmarkIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkIconSolid } from "@heroicons/react/24/solid";
import { SlashCommandDescription } from "core";
import { useState } from "react";
import { defaultBorderRadius, GhostButton, vscInputBackground } from "..";

interface ConversationStarterCardProps {
  command: SlashCommandDescription;
  onClick: (command: SlashCommandDescription) => void;
  onBookmark: (command: SlashCommandDescription) => void;
  isBookmarked: boolean;
}

export function ConversationStarterCard({
  command,
  onClick,
  onBookmark,
  isBookmarked = false,
}: ConversationStarterCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="mb-2 w-full shadow-md hover:brightness-110"
      style={{
        borderRadius: defaultBorderRadius,
        backgroundColor: vscInputBackground,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center px-3 py-1.5">
        <div className="mr-3 flex-shrink-0">
          <ChatBubbleLeftIcon className="text-lightgray h-5 w-5" />
        </div>
        <div
          onClick={() => onClick(command)}
          className="flex flex-1 flex-col hover:cursor-pointer"
        >
          <div className="font-medium">{command.name}</div>
          <div className="text-lightgray text-sm">{command.description}</div>
        </div>
        <div className="flex items-center">
          <GhostButton
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(command);
            }}
            aria-label={
              isBookmarked ? "Remove bookmarked prompt" : "Bookmark prompt"
            }
            className={isHovered || isBookmarked ? "opacity-100" : "opacity-0"}
          >
            {isBookmarked ? (
              <BookmarkIconSolid className="h-4 w-4" />
            ) : (
              <BookmarkIcon className="h-4 w-4" />
            )}
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
