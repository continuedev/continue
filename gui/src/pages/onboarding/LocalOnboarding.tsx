import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { StyledButton } from "./components";
import { CopyToTerminalButton } from "./CopyToTerminalButton";
import { CheckMarkHeader } from "./CheckMarkHeader";
import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";

type OllamaConnectionStatuses =
  | "waiting_to_download"
  | "downloading"
  | "verified";

enum DefaultLocaLModels {
  Chat = "llama3",
  Autocomplete = "starcoder2:3b",
  Embeddings = "embed-text", // "nomic-embed-text",
}

const OLLAMA_DOWNLOAD_URL = "https://ollama.ai";
const REFETCH_MODELS_INTERVAL_MS = 1000;

function LocalOnboarding() {
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[] | undefined
  >(undefined);

  const [ollamaConnectionStatus, setOllamaConnectionStatus] =
    useState<OllamaConnectionStatuses>("waiting_to_download");

  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);

  const isOllamaConnected = ollamaConnectionStatus === "verified";

  function handleCompleteClick() {
    navigate("/");
  }

  function isModelDownloaded(model: string) {
    if (!downloadedOllamaModels) {
      return false;
    }

    return downloadedOllamaModels.some(
      (ollamaModel) => ollamaModel.startsWith(model), // We use `startsWith` to ignore trailing tags like `:latest`
    );
  }

  function handleDownloadOllamaClick() {
    setOllamaConnectionStatus("downloading");
    navigate(OLLAMA_DOWNLOAD_URL);
  }

  function renderOllamaConnectionStatus(status: OllamaConnectionStatuses) {
    switch (status) {
      case "waiting_to_download":
        return (
          <>
            <p>
              {`Click below to download Ollama from ${OLLAMA_DOWNLOAD_URL}. Once
                downloaded, you only need to start the application.`}
            </p>
            <div className="text-center">
              <Button onClick={handleDownloadOllamaClick}>
                Download Ollama
              </Button>
            </div>
          </>
        );

      case "downloading":
        return <p>Checking for connection to Ollama...</p>;

      case "verified":
        return <></>;

      default:
        return <></>;
    }
  }

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (!hasLoadedChatModel && isModelDownloaded(DefaultLocaLModels.Chat)) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      setHasLoadedChatModel(true);
    }
  }, [downloadedOllamaModels]);

  /**
   * Sets up an interval that runs every `REFETCH_MODELS_INTERVAL_MS`
   * to fetch the list of downloaded models and update state.
   */
  useEffect(() => {
    const fetchDownloadedModels = async () => {
      const models = await ideMessenger.request("llm/listModels", {
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      if (Array.isArray(models)) {
        // If we got a response, the connection has been verified
        if (!isOllamaConnected) {
          setOllamaConnectionStatus("verified");
        }

        setDownloadedOllamaModels(models);
      }
    };

    const interval = setInterval(
      fetchDownloadedModels,
      REFETCH_MODELS_INTERVAL_MS,
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-8 overflow-y-scroll">
      <h1 className="text-center">Set up your local LLM</h1>

      <CheckMarkHeader isComplete={isOllamaConnected}>
        1. Download and start Ollama
      </CheckMarkHeader>
      {renderOllamaConnectionStatus(ollamaConnectionStatus)}

      <CheckMarkHeader isComplete={isModelDownloaded(DefaultLocaLModels.Chat)}>
        2. Download a model for chat
      </CheckMarkHeader>
      {!isModelDownloaded(DefaultLocaLModels.Chat) && (
        <>
          <p>
            We recommend using <code>{DefaultLocaLModels.Chat}</code>, the
            latest open-source model trained by Meta.
          </p>

          <CopyToTerminalButton
            command={`ollama run ${DefaultLocaLModels.Chat}`}
          ></CopyToTerminalButton>
        </>
      )}

      <CheckMarkHeader
        isComplete={isModelDownloaded(DefaultLocaLModels.Autocomplete)}
      >
        3. Download a model for tab autocomplete
      </CheckMarkHeader>

      {!isModelDownloaded(DefaultLocaLModels.Autocomplete) && (
        <>
          <p>
            We recommend using <code>{DefaultLocaLModels.Autocomplete}</code>, a
            state-of-the-art 3B parameter autocomplete model trained by Hugging
            Face.
          </p>

          <CopyToTerminalButton
            command={`ollama run ${DefaultLocaLModels.Autocomplete}`}
          ></CopyToTerminalButton>
        </>
      )}

      <CheckMarkHeader
        isComplete={isModelDownloaded(DefaultLocaLModels.Embeddings)}
      >
        4. Download a model for embeddings
      </CheckMarkHeader>

      {!isModelDownloaded(DefaultLocaLModels.Embeddings) && (
        <>
          <p>
            We recommend using <code>{DefaultLocaLModels.Embeddings}</code>, a
            8192 context-length that outperforms OpenAI <code>ada-002</code> and{" "}
            <code>text-embedding-3-small</code>
            on both short and long context tasks.
          </p>

          <CopyToTerminalButton
            command={`ollama run ${DefaultLocaLModels.Embeddings}`}
          ></CopyToTerminalButton>
        </>
      )}

      <div className="flex flex-col justify-end mt-8">
        <StyledButton onClick={handleCompleteClick}>Complete</StyledButton>
      </div>
    </div>
  );
}

export default LocalOnboarding;
