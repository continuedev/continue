import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { CopyToTerminalButton } from "./CopyToTerminalButton";

interface ModelDownloadProps {
  title: string;
  modelName: string;
  hasDownloaded: boolean;
}

function ModelDownload({
  title,
  modelName,
  hasDownloaded,
}: ModelDownloadProps) {
  const command = `ollama pull ${modelName}`;

  return (
    <div className="flex flex-col">
      <p className="text-lg font-bold leading-tight mb-2">{title}</p>
      <div className="flex justify-between items-center">
        <p className="font-mono">{command}</p>
        {hasDownloaded ? (
          <CheckCircleIcon
            width="24px"
            height="24px"
            className="text-emerald-600"
          />
        ) : (
          <CopyToTerminalButton command={command} />
        )}
      </div>
    </div>
  );
}

export default ModelDownload;
