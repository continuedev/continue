import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import React, { Fragment, useContext, useEffect, useState } from "react";
import { GUIClientContext } from "../App";
import { RootStore } from "../redux/store";
import { useDispatch, useSelector } from "react-redux";
import { ChevronUpDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Listbox, Transition } from "@headlessui/react";
import ReactDOM from "react-dom";

const MODEL_INFO: { title: string; class: string; args: any }[] = [
  {
    title: "OpenAI",
    class: "OpenAI",
    args: {
      model: "gpt-4",
      api_key: "",
    },
  },
  {
    title: "Anthropic",
    class: "AnthropicLLM",
    args: {
      model: "claude-2",
      api_key: "<ANTHROPIC_API_KEY>",
    },
  },
  {
    title: "Ollama",
    class: "Ollama",
    args: {
      model: "codellama",
    },
  },
  {
    title: "TogetherAI",
    class: "TogetherLLM",
    args: {
      model: "togethercomputer/CodeLlama-13b-Instruct",
      api_key: "<TOGETHER_API_KEY>",
    },
  },
  {
    title: "Replicate",
    class: "ReplicateLLM",
    args: {
      model:
        "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781",
      api_key: "<REPLICATE_API_KEY>",
    },
  },
  {
    title: "llama.cpp",
    class: "LlamaCpp",
    args: {},
  },
  {
    title: "HuggingFace Inference API",
    class: "HuggingFaceInferenceAPI",
    args: {
      endpoint_url: "<INFERENCE_API_ENDPOINT_URL>",
      hf_token: "<HUGGING_FACE_TOKEN>",
    },
  },
  {
    title: "Google PaLM API",
    class: "GooglePaLMAPI",
    args: {
      model: "chat-bison-001",
      api_key: "<MAKERSUITE_API_KEY>",
    },
  },
  {
    title: "LM Studio",
    class: "GGML",
    args: {
      server_url: "http://localhost:1234",
    },
  },
  {
    title: "Other OpenAI-compatible API",
    class: "GGML",
    args: {
      server_url: "<SERVER_URL>",
    },
  },
  {
    title: "GPT-4 limited free trial",
    class: "OpenAIFreeTrial",
    args: {
      model: "gpt-4",
    },
  },
];

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

const Select = styled.select`
  border: none;
  max-width: 25vw;
  background-color: ${vscBackground};
  color: ${vscForeground};
  padding: 6px;
  max-height: 35vh;
  overflow: scroll;
  cursor: pointer;

  &:focus {
    outline: none;
  }
  &:hover {
    background-color: ${secondaryDark};
  }
`;

const StyledPlusIcon = styled(PlusIcon)`
  background-color: ${vscBackground};
  cursor: pointer;
  margin: 0px;
  padding-left: 4px;
  padding-right: 4px;
  height: 100%;

  &:hover {
    background-color: ${secondaryDark};
  }
  border-left: 0.5px solid ${lightGray};
`;

const NewProviderDiv = styled.div`
  cursor: pointer;
  padding: 8px;
  padding-left: 16px;
  padding-right: 16px;
  border-top: 0.5px solid ${lightGray};

  &:hover {
    background-color: ${secondaryDark};
  }
`;

const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
  padding: 0;
  min-width: 80px;
`;

const StyledListboxButton = styled(Listbox.Button)`
  position: relative;
  cursor: pointer;
  background-color: ${vscBackground};
  text-align: left;
  border: none;
  margin: 0;
  height: 100%;
  width: 100%;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  color: ${vscForeground};

  padding: 4px 8px;

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: ${secondaryDark};
  }
`;

const StyledListboxOptions = styled(Listbox.Options)`
  background-color: ${secondaryDark};
  padding: 0;

  position: absolute;
  bottom: calc(100% - 16px);
  max-width: 100%;

  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

const StyledListboxOption = styled(Listbox.Option)<{ selected: boolean }>`
  background-color: ${({ selected }) =>
    selected ? `${buttonColor}88` : secondaryDark};
  cursor: pointer;
  padding: 6px 8px;

  &:hover {
    background-color: ${buttonColor}44;
  }
`;

function modelSelectTitle(model: any): string {
  if (model?.title) return model?.title;
  if (model?.model !== undefined && model?.model.trim() !== "") {
    if (model?.class_name) {
      return `${model?.class_name} - ${model?.model}`;
    }
    return model?.model;
  }
  return model?.class_name;
}

interface Option {
  value: string;
  title: string;
}

function ModelSelect(props: {}) {
  const client = useContext(GUIClientContext);
  const defaultModel = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.default
  );
  const savedModels = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.saved
  );

  const navigate = useNavigate();

  const DEFAULT_OPTION = {
    value: JSON.stringify({
      t: "default",
      idx: -1,
    }),
    title: "GPT-4",
  };
  const [options, setOptions] = useState<Option[]>([DEFAULT_OPTION]);

  useEffect(() => {
    if (!defaultModel && !savedModels) {
      setOptions([DEFAULT_OPTION]);
      return;
    }
    const newOptions: Option[] = [];
    if (defaultModel) {
      newOptions.push({
        value: JSON.stringify({
          t: "default",
          idx: -1,
        }),
        title: modelSelectTitle(defaultModel),
      });
    }

    savedModels?.forEach((model: any, idx: number) => {
      newOptions.push({
        value: JSON.stringify({
          t: "saved",
          idx,
        }),
        title: modelSelectTitle(model),
      });
    });
    setOptions(newOptions);
  }, [defaultModel, savedModels]);

  const topDiv = document.getElementById("model-select-top-div");

  return (
    <>
      <GridDiv>
        <StyledListbox
          value={JSON.stringify({
            t: "default",
            idx: -1,
          })}
          onChange={(val: string) => {
            const value = JSON.parse(val);
            if (value.t === "saved") {
              client?.setModelForRoleFromIndex("*", value.idx);
            }
          }}
          defaultValue={"0"}
        >
          <div className="relative">
            <StyledListboxButton>
              <div>{modelSelectTitle(defaultModel) || "GPT-4"}</div>
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </StyledListboxButton>
            {topDiv &&
              ReactDOM.createPortal(
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <StyledListboxOptions>
                    {options.map((option, idx) => (
                      <StyledListboxOption
                        key={idx}
                        selected={
                          option.value ===
                          JSON.stringify({
                            t: "default",
                            idx: -1,
                          })
                        }
                        value={option.value}
                      >
                        <span>{option.title}</span>
                      </StyledListboxOption>
                    ))}
                  </StyledListboxOptions>
                </Transition>,
                topDiv
              )}
          </div>
        </StyledListbox>

        <StyledPlusIcon
          width="1.3em"
          height="1.3em"
          onClick={() => {
            navigate("/models");
          }}
        />
      </GridDiv>
    </>
  );
}

export default ModelSelect;
