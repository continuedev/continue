import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useState, useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { useDownloadOllamaModels } from "./useDownloadOllamaModels";
import LinkButton from "../../LinkButton";

export enum OllamaConnectionStatuses {
  WaitingToDownload = "WaitingToDownload",
  Downloading = "Downloading",
  Verified = "Verified",
}

interface OllamaStatusProps {
  onConnectionVerified: () => void;
}

const {
  ollama: { downloadUrl },
} = providers;

function OllamaStatus({ onConnectionVerified }: OllamaStatusProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [status, setStatus] = useState<OllamaConnectionStatuses>(
    OllamaConnectionStatuses.WaitingToDownload,
  );

  useDownloadOllamaModels((models) => {
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
        <div className="-mx-3">
          <LinkButton onClick={onClickDownload} url={downloadUrl} />
        </div>
      );
    case OllamaConnectionStatuses.Downloading:
      return (
        <div className="flex justify-between items-center ">
          <p className="text-sm w-3/4">
            Checking for connection to Ollama at http://localhost:11434
          </p>
          <ArrowPathIcon className="h-4 w-4 animate-spin-slow" />
        </div>
      );
    case OllamaConnectionStatuses.Verified:
      return (
        <div className="flex justify-between items-center">
          <p className="text-sm w-3/4">
            Ollama is running at http://localhost:11434
          </p>
          <CheckCircleIcon
            width="24px"
            height="24px"
            className="text-emerald-600"
          />
        </div>
      );
  }
}

export default OllamaStatus;
