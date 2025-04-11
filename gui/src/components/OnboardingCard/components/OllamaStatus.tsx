import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { StyledActionButton } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { OllamaConnectionStatuses } from "../utils";
import OllamaCompletedStep from "./OllamaCompletedStep";

interface OllamaStatusProps {
  isOllamaConnected: boolean;
}

const downloadUrl = providers.ollama!.downloadUrl!;

export function OllamaStatus({ isOllamaConnected }: OllamaStatusProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [status, setStatus] = useState<OllamaConnectionStatuses>(
    OllamaConnectionStatuses.WaitingToDownload,
  );
  useEffect(() => {
    if (isOllamaConnected) {
      setStatus(OllamaConnectionStatuses.Connected);
    } else if (status !== OllamaConnectionStatuses.Downloading) {
      setStatus(OllamaConnectionStatuses.WaitingToDownload);
    }
  }, [status, isOllamaConnected]);

  function onClickDownload() {
    ideMessenger.post("openUrl", downloadUrl);
    setStatus(OllamaConnectionStatuses.Downloading);
  }

  switch (status) {
    case OllamaConnectionStatuses.WaitingToDownload:
      return (
        <StyledActionButton onClick={onClickDownload}>
          <p className="mr-1 line-clamp-1 text-sm underline">{downloadUrl}</p>
          <ArrowTopRightOnSquareIcon width={16} height={16} />
        </StyledActionButton>
      );
    case OllamaConnectionStatuses.Downloading:
      return (
        <div className="flex items-center justify-between">
          <p className="lines mr-1 w-3/4 font-mono text-sm">
            Checking for connection to Ollama at http://localhost:11434
          </p>
          <ArrowPathIcon className="animate-spin-slow mr-1 h-3 w-3" />
        </div>
      );
    case OllamaConnectionStatuses.Connected:
      return (
        <OllamaCompletedStep text="Ollama is running at http://localhost:11434" />
      );
  }
}
