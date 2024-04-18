import { CheckIcon, PlayIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
  vscForeground,
} from "../components";
import { ideRequest } from "../util/ide";
import { WebviewIde } from "../util/webviewIde";
import { StyledButton } from "./onboarding/components";

const ModelPillDiv = styled.div<{ selected: boolean }>`
  padding: 4px 4px;
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${({ selected }) =>
    selected ? vscButtonBackground : "transparent"};
  color: ${({ selected }) => (selected ? vscButtonForeground : vscForeground)};
  cursor: pointer;
  transition: background-color 0.1s ease-out;

  text-align: center;
  align-items: center;

  &:hover {
    color: ${vscButtonForeground};
    background-color: ${vscButtonBackground};
  }
`;

function CheckMarkHeader(props: { children: string; complete: boolean }) {
  return (
    <div className="flex gap-4 items-center">
      {props.complete ? (
        <CheckCircleIconSolid
          width="24px"
          height="24px"
          color="#0b0"
        ></CheckCircleIconSolid>
      ) : (
        <div
          className="flex-none border border-solid rounded-full w-5 h-5 mt-1"
          style={{ borderColor: lightGray }}
        ></div>
      )}
      <h3>{props.children}</h3>
    </div>
  );
}

const RunInTerminalDiv = styled.div<{ clicked: boolean }>`
  padding-left: 8px;
  padding-right: 8px;
  display: flex;
  border-radius: ${defaultBorderRadius};
  width: fit-content;
  gap: 8px;

  ${({ clicked }) => clicked && "background-color: #0f02;"}

  align-items: center;

  border: 1px solid ${lightGray};

  cursor: pointer;
  &:hover {
    background-color: ${({ clicked }) => (clicked ? "#0f02" : "#fff1")};
  }
`;

function RunInTerminalButton(props: { command: string }) {
  const [clicked, setClicked] = useState(false);

  const id = `info-hover-${encodeURIComponent(props.command)}`;
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <div
        className="flex items-center justify-center mt-8"
        data-tooltip-id={id}
      >
        <RunInTerminalDiv
          clicked={clicked}
          style={{ border: `0.5px solid ${lightGray}` }}
          className="grid-cols-2"
          onClick={() => {
            new WebviewIde().runCommand(props.command);
            setClicked(true);
            setTimeout(() => setClicked(false), 2000);
          }}
        >
          <pre>
            <code
              style={{
                color: vscForeground,
                backgroundColor: "transparent",
              }}
            >
              {props.command}
            </code>
          </pre>
          {clicked ? (
            <CheckIcon
              width="20px"
              height="20px"
              className="cursor-pointer hover:bg-white"
              color="#0b0"
            />
          ) : (
            <PlayIcon
              width="20px"
              height="20px"
              className="cursor-pointer hover:bg-white"
            />
          )}
        </RunInTerminalDiv>
      </div>
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={id} place="top">
            Run in terminal
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
}

function LocalOnboarding() {
  const navigate = useNavigate();

  const [stage1Done, setStage1Done] = useState(false);
  const [stage2Done, setStage2Done] = useState(false);
  const [stage3Done, setStage3Done] = useState(false);

  const [ollamaModels, setOllamaModels] = useState<string[] | undefined>(
    undefined,
  );
  const [ollamaConnectionStatus, setOllamaConnectionStatus] = useState<
    "waitingToDownload" | "downloading" | "verified"
  >("waitingToDownload");

  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (ollamaModels?.some((model) => model.startsWith("llama3"))) {
      setStage2Done(true);
    }
  }, [ollamaModels]);

  useEffect(() => {
    if (ollamaModels?.some((model) => model.startsWith("starcoder2:3b"))) {
      setStage3Done(true);
    }
  }, [ollamaModels]);

  useEffect(() => {
    const interval = setInterval(async () => {
      // The "Ollama" title is assumed from core/config/onboarding.ts
      const models = await ideRequest("llm/listModels", { title: "Ollama" });
      if (Array.isArray(models)) {
        setOllamaConnectionStatus("verified");
        setStage1Done(true);
        setOllamaModels(models);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [ollamaConnectionStatus]);

  return (
    <div className="p-8 overflow-y-scroll">
      <h1 className="text-center">Set up your local LLM</h1>
      <CheckMarkHeader complete={stage1Done}>
        1. Download Ollama
      </CheckMarkHeader>
      {ollamaConnectionStatus === "verified" || (
        <>
          <p>Click below to download Ollama from https://ollama.ai.</p>
          <div className="text-center">
            <a href="https://ollama.ai">
              <Button onClick={() => setOllamaConnectionStatus("downloading")}>
                Download Ollama
              </Button>
            </a>
          </div>
        </>
      )}
      {ollamaConnectionStatus === "downloading" && (
        <p>Checking for connection to Ollama...</p>
      )}
      {ollamaConnectionStatus === "verified" && <p>Ollama is connected!</p>}
      <br></br>
      <CheckMarkHeader complete={stage2Done}>
        2. Download a model for chat
      </CheckMarkHeader>
      {stage1Done && (
        <>
          We recommend using Llama 3, the latest open-source model trained by
          Meta.
          <br></br>
          <RunInTerminalButton command="ollama run llama3"></RunInTerminalButton>
        </>
      )}
      <br></br>
      <CheckMarkHeader complete={stage3Done}>
        3. Download a model for tab autocomplete
      </CheckMarkHeader>
      {stage1Done && (
        <>
          We recommend using Llama 3, the latest open-source model trained by
          Meta.
          <br></br>
          <RunInTerminalButton command="ollama run starcoder2:3b"></RunInTerminalButton>
        </>
      )}
      {/* {ollamaModels?.length > 0 || (
        <div>
          <p>
            It looks like you don't have any models downloaded. Click here to
            download the recommended model, "starcoder2:3b". This will take up
            1.7GB of space.
          </p>
          <div className="text-right">
            <Button onClick={() => {}}>Download Starcoder 2</Button>
          </div>
        </div>
      )} */}
      {/* <div className="flex gap-1 flex-wrap">
        {ollamaModels?.map((model) => {
          return (
            <ModelPillDiv
              selected={selectedModel === model}
              onClick={() => setSelectedModel(model)}
            >
              {model}
            </ModelPillDiv>
          );
        })}
      </div> */}
      <br></br>
      <div className="flex flex-col justify-end mt-8">
        <StyledButton
          disabled={false}
          onClick={() => {
            navigate("/");
          }}
        >
          Continue
        </StyledButton>
      </div>
    </div>
  );
}

export default LocalOnboarding;
