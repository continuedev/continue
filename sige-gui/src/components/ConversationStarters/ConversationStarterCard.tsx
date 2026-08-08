import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { SlashCommandDescWithSource } from "core";

interface ConversationStarterCardProps {
  command: SlashCommandDescWithSource;
  onClick: (command: SlashCommandDescWithSource) => void;
}

export function ConversationStarterCard({
  command,
  onClick,
}: ConversationStarterCardProps) {
  return (
    <div
      className="bg-vsc-input-background mb-2 w-full rounded-md shadow-md hover:cursor-pointer hover:brightness-110"
      onClick={() => onClick(command)}
    >
      <div className="flex px-3 py-1.5">
        <div className="mr-3 flex-shrink-0 self-start pt-0.5">
          <ChatBubbleLeftIcon className="text-lightgray h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-xs font-medium">{command.name}</div>
          {command.description && (
            <div className="text-lightgray text-xs">{command.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
