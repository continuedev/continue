import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { StyledActionButton } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { ToolTip } from "../../gui/Tooltip";
import OllamaCompletedStep from "./OllamaCompletedStep";

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

  function onClick() {
    void ideMessenger.ide.runCommand(command);
    ideMessenger.post("copyText", { text: command });
  }

  return (
    <div className="flex flex-col">
      <p className="mb-0 mt-4 text-base font-semibold">{title}</p>
      {hasDownloaded ? (
        <OllamaCompletedStep text={command} />
      ) : (
        <ToolTip place="top" content="Copy into terminal">
          <StyledActionButton onClick={onClick} className="gap-2">
            <p className="lines m-0 px-0 py-2 font-mono text-xs">{command}</p>
            <CommandLineIcon width={16} height={16} />
          </StyledActionButton>
        </ToolTip>
      )}
    </div>
  );
}

export default OllamaModelDownload;
