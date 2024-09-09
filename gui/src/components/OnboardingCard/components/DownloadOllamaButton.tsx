import { StyledDiv } from "./CopyToTerminalButton";
import OllamaLogo from "./OllamaLogo";

export interface DownloadOllamaButtonProps {
  onClick: () => void;
}

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

function DownloadOllamaButton({ onClick }: DownloadOllamaButtonProps) {
  return (
    <div className="flex items-center justify-end flex-1">
      <StyledDiv className="grid-cols-2">
        <OllamaLogo height={20} width={20} />
        <a
          className="flex items-center gap-2 text-inherit hover:text-inherit no-underline hover:no-underline"
          href={OLLAMA_DOWNLOAD_URL}
          target="_blank"
          onClick={onClick}
        >
          Download Ollama
        </a>
      </StyledDiv>
    </div>
  );
}

export default DownloadOllamaButton;
