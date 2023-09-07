import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import { useContext } from "react";
import { GUIClientContext } from "../App";
import { RootStore } from "../redux/store";
import { useDispatch, useSelector } from "react-redux";
import { PlusIcon } from "@heroicons/react/24/outline";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiStateSlice";

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
    title: "Other OpenAI-compatible API",
    class: "GGML",
    args: {
      server_url: "<SERVER_URL>",
    },
  },
  {
    title: "GPT-4 limited free trial",
    class: "MaybeProxyOpenAI",
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

function modelSelectTitle(model: any): string {
  if (model.title) return model.title;
  if (model.model !== undefined && model.model.trim() !== "") {
    if (model.class_name) {
      return `${model.class_name} - ${model.model}`;
    }
    return model.model;
  }
  return model.class_name;
}

function ModelSelect(props: {}) {
  const dispatch = useDispatch();
  const client = useContext(GUIClientContext);
  const defaultModel = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.default
  );
  const unusedModels = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.unused
  );

  return (
    <GridDiv>
      <Select
        value={JSON.stringify({
          t: "default",
          idx: -1,
        })}
        defaultValue={0}
        onChange={(e) => {
          const value = JSON.parse(e.target.value);
          if (value.t === "unused") {
            client?.setModelForRoleFromIndex("*", value.idx);
          }
        }}
      >
        {defaultModel && (
          <option
            value={JSON.stringify({
              t: "default",
              idx: -1,
            })}
          >
            {modelSelectTitle(defaultModel)}
          </option>
        )}
        {unusedModels?.map((model: any, idx: number) => {
          return (
            <option
              value={JSON.stringify({
                t: "unused",
                idx,
              })}
            >
              {modelSelectTitle(model)}
            </option>
          );
        })}
      </Select>

      <StyledPlusIcon
        width="1.3em"
        height="1.3em"
        onClick={() => {
          dispatch(
            setDialogMessage(
              <div>
                <div className="text-lg font-bold p-2">
                  Setup a new model provider
                </div>
                <br />
                {MODEL_INFO.map((model, idx) => {
                  return (
                    <NewProviderDiv
                      onClick={() => {
                        const model = MODEL_INFO[idx];
                        client?.addModelForRole("*", model.class, model.args);
                        dispatch(setShowDialog(false));
                      }}
                    >
                      {model.title}
                    </NewProviderDiv>
                  );
                })}
                <br />
              </div>
            )
          );
          dispatch(setShowDialog(true));
        }}
      />
    </GridDiv>
  );
}

export default ModelSelect;
