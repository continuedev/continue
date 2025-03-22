import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { SlashCommandDescription } from "core";
import { useState } from "react";
import { defaultBorderRadius, vscInputBackground } from "..";

interface ConversationStarterCardProps {
  command: SlashCommandDescription;
  onClick: (command: SlashCommandDescription) => void;
}

export function ConversationStarterCard({
  command,
  onClick,
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
      </div>
    </div>
  );
}
