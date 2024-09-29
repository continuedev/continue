import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import ReactDOM from "react-dom";
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
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  function onClick() {
    ideMessenger.ide.runCommand(command);
    ideMessenger.post("copyText", { text: command });
  }

  return (
    <div className="flex flex-col">
      <p className="text-lg font-bold leading-tight mb-2">{title}</p>
      {hasDownloaded ? (
        <OllamaCompletedStep text={command} />
      ) : (
        <>
          <StyledActionButton data-tooltip-id={id} onClick={onClick}>
            <p className="font-mono truncate">{command}</p>
            <CommandLineIcon width={24} height={24} />
          </StyledActionButton>
          {tooltipPortalDiv &&
            ReactDOM.createPortal(
              <ToolTip id={id} place="top">
                Copy into terminal
              </ToolTip>,
              tooltipPortalDiv,
            )}
        </>
      )}
    </div>
  );
}

export default OllamaModelDownload;
