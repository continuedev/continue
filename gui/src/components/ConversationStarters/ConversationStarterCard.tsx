import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { SlashCommandDescription } from "core";
import { defaultBorderRadius, vscInputBackground } from "..";

interface ConversationStarterCardProps {
  command: SlashCommandDescription;
  onClick: (command: SlashCommandDescription) => void;
}

export function ConversationStarterCard({
  command,
  onClick,
}: ConversationStarterCardProps) {
  return (
    <div
      onClick={() => onClick(command)}
      className="mb-2 w-full shadow-md hover:cursor-pointer hover:brightness-110"
      style={{
        borderRadius: defaultBorderRadius,
        backgroundColor: vscInputBackground,
      }}
    >
      <div className="flex items-start p-3">
        <div className="mr-3 flex-shrink-0">
          <ChatBubbleLeftIcon className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex flex-col">
          <div className="font-medium text-gray-200">{command.name}</div>
          <div className="text-sm text-gray-400">{command.description}</div>
        </div>
      </div>
    </div>
  );
}
