import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { useState, useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { useCheckOllamaModels } from "../hooks/useCheckOllamaModels";
import { StyledActionButton } from "../..";
import OllamaCompletedStep from "./OllamaCompletedStep";
import { OllamaConnectionStatuses } from "../utils";

interface OllamaStatusProps {
  onConnectionVerified: () => void;
}

const {
  ollama: { downloadUrl },
} = providers;

export function OllamaStatus({ onConnectionVerified }: OllamaStatusProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [status, setStatus] = useState<OllamaConnectionStatuses>(
    OllamaConnectionStatuses.WaitingToDownload,
  );

  useCheckOllamaModels((models) => {
    setStatus(OllamaConnectionStatuses.Verified);
    onConnectionVerified();
  });

  function onClickDownload() {
    ideMessenger.post("openUrl", downloadUrl);
    setStatus(OllamaConnectionStatuses.Downloading);
  }

  switch (status) {
    case OllamaConnectionStatuses.WaitingToDownload:
      return (
        <StyledActionButton onClick={onClickDownload}>
          <p className="underline text-sm">{downloadUrl}</p>
          <ArrowTopRightOnSquareIcon width={24} height={24} />
        </StyledActionButton>
      );
    case OllamaConnectionStatuses.Downloading:
      return (
        <div className="flex justify-between items-center">
          <p className="text-sm w-3/4 font-mono">
            Checking for connection to Ollama at http://localhost:11434
          </p>
          <ArrowPathIcon className="h-4 w-4 animate-spin-slow mr-1" />
        </div>
      );
    case OllamaConnectionStatuses.Verified:
      return (
        <OllamaCompletedStep text="Ollama is running at http://localhost:11434" />
      );
  }
}
