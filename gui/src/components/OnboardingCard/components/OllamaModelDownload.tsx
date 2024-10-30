import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { StyledActionButton } from "../..";
import OllamaCompletedStep from "./OllamaCompletedStep";
import { ToolTip } from "../../gui/Tooltip";

interface OllamaModelDownloadProps {
  title: string;
  modelName: string;
  hasDownloaded: boolean;
}

function OllamaModelDownload({
  title,
  modelName,
  hasDownloaded,
}: OllamaModelDownloadProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const command = `ollama pull ${modelName}`;
  const id = `info-hover-${encodeURIComponent(command)}`;

  function onClick() {
    void ideMessenger.ide.runCommand(command);
    ideMessenger.post("copyText", { text: command });
  }

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-lg font-bold leading-tight">{title}</p>
      {hasDownloaded ? (
        <OllamaCompletedStep text={command} />
      ) : (
        <>
          <StyledActionButton data-tooltip-id={id} onClick={onClick}>
            <p className="truncate font-mono text-sm">{command}</p>
            <CommandLineIcon width={24} height={24} />
          </StyledActionButton>

          <ToolTip id={id} place="top">
            Copy into terminal
          </ToolTip>
        </>
      )}
    </div>
  );
}

export default OllamaModelDownload;
