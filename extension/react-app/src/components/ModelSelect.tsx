import styled from "styled-components";
import {
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import { useContext, useEffect } from "react";
import { GUIClientContext } from "../App";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";

const MODEL_INFO: { title: string; class: string; args: any }[] = [
  {
    title: "gpt-4",
    class: "MaybeProxyOpenAI",
    args: {
      model: "gpt-4",
      api_key: "",
    },
  },
  {
    title: "gpt-3.5-turbo",
    class: "MaybeProxyOpenAI",
    args: {
      model: "gpt-3.5-turbo",
      api_key: "",
    },
  },
  {
    title: "claude-2",
    class: "AnthropicLLM",
    args: {
      model: "claude-2",
      api_key: "<ANTHROPIC_API_KEY>",
    },
  },
  {
    title: "GGML",
    class: "GGML",
    args: {},
  },
  {
    title: "Ollama",
    class: "Ollama",
    args: {
      model: "codellama",
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
    title: "TogetherAI",
    class: "TogetherLLM",
    args: {
      model: "togethercomputer/CodeLlama-13b-Instruct",
      api_key: "<TOGETHER_API_KEY>",
    },
  },
  {
    title: "llama.cpp",
    class: "LlamaCpp",
    args: {},
  },
];

const Select = styled.select`
  border: none;
  width: 25vw;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  border-radius: ${defaultBorderRadius};
  padding: 6px;
  max-height: 35vh;
  overflow: scroll;
  cursor: pointer;
  margin-right: auto;

  &:focus {
    outline: none;
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
  const client = useContext(GUIClientContext);
  const defaultModel = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.default
  );
  const unusedModels = useSelector(
    (state: RootStore) => (state.serverState.config as any)?.models?.unused
  );

  return (
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
        } else if (value.t === "new") {
          const model = MODEL_INFO[value.idx];
          client?.addModelForRole("*", model.class, model.args);
        }
      }}
    >
      <optgroup label="My Saved Models">
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
      </optgroup>
      <optgroup label="Add New Model">
        {MODEL_INFO.map((model, idx) => {
          return (
            <option
              value={JSON.stringify({
                t: "new",
                idx,
              })}
            >
              {model.title}
            </option>
          );
        })}
      </optgroup>
    </Select>
  );
}

export default ModelSelect;
