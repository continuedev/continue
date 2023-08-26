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
      model: "gpt-4",
      api_key: "<TOGETHER_API_KEY>",
    },
  },
];

const Select = styled.select`
  border: none;
  width: fit-content;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  border-radius: ${defaultBorderRadius};
  padding: 6px;
  /* box-shadow: 0px 0px 1px 0px ${vscForeground}; */
  max-height: 35vh;
  overflow: scroll;
  cursor: pointer;
  margin-right: auto;

  &:focus {
    outline: none;
  }
`;

function ModelSelect(props: {}) {
  const client = useContext(GUIClientContext);
  const defaultModel = useSelector(
    (state: RootStore) =>
      (state.serverState.config as any)?.models?.default?.class_name
  );

  return (
    <Select
      defaultValue={0}
      onChange={(e) => {
        const model = MODEL_INFO[parseInt(e.target.value)];
        client?.setModelForRole("*", model.class, model.args);
      }}
    >
      {MODEL_INFO.map((model, idx) => {
        return (
          <option selected={defaultModel === model.class} value={idx}>
            {model.title}
          </option>
        );
      })}
    </Select>
  );
}

export default ModelSelect;
