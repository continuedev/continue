import { LLMInteraction } from "../../hooks/useLLMLog";
import useLLMSummary from "../../hooks/useLLMSummary";
import StatusIcon from "./StatusIcon";

export interface ListItemProps {
  interactionId: string;
  interaction: LLMInteraction;
  selected: boolean;
  onClickInteraction: (interactionId: string) => void;
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  // Format seconds with one decimal place
  const secondsFormatted = `${seconds}.${Math.floor(milliseconds / 100)}`;

  return `${hours}:${minutes}:${secondsFormatted.padStart(4, "0")}`;
}

export default function ListItem({
  interactionId,
  interaction,
  onClickInteraction,
  selected,
}: ListItemProps) {
  const summary = useLLMSummary(interaction);

  return (
    <li
      className={
        "w-full cursor-pointer pb-[3px] pl-[4px] pr-[4px] pt-[3px] " +
        (selected
          ? "bg-[color:var(--vscode-list-inactiveSelectionBackground)]" +
            " text-[color:var(--vscode-list-inctiveSelectionForeground)]" +
            " group-focus-within:bg-[color:var(--vscode-list-activeSelectionBackground)]" +
            " group-focus-within:text-[color:var(--vscode-list-activeSelectionForeground)]"
          : "hover:bg-[color:var(--vscode-list-inactiveSelectionBackground)]")
      }
      key={interactionId}
      onClick={() => onClickInteraction(interactionId)}
    >
      <StatusIcon interaction={interaction}></StatusIcon>{" "}
      <span className="inline-block w-[70px]">
        {interaction.start ? formatTimestamp(interaction.start.timestamp) : ""}
      </span>
      <span className="inline-block">{summary.type}</span>
    </li>
  );
}
