import React from "react";
import ModelCard, { ModelInfo, ModelTag } from "../components/ModelCard";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { lightGray } from "../components";
import { useNavigate } from "react-router-dom";

const MODEL_INFO: ModelInfo[] = [
  {
    title: "OpenAI",
    class: "OpenAI",
    description: "",
    args: {
      model: "gpt-4",
      api_key: "",
      title: "OpenAI",
    },
    icon: "openai.svg",
    tags: [ModelTag["Requires API Key"]],
  },
  {
    title: "Anthropic",
    class: "AnthropicLLM",
    description: "",
    args: {
      model: "claude-2",
      api_key: "<ANTHROPIC_API_KEY>",
      title: "Anthropic",
    },
    icon: "anthropic.png",
    tags: [ModelTag["Requires API Key"]],
  },
  {
    title: "Ollama",
    class: "Ollama",
    description: "",
    args: {
      model: "codellama",
      title: "Ollama",
    },
    icon: "ollama.png",
    tags: [ModelTag["Local"], ModelTag["Open-Source"]],
  },
  {
    title: "TogetherAI",
    class: "TogetherLLM",
    description: "",
    args: {
      model: "togethercomputer/CodeLlama-13b-Instruct",
      api_key: "<TOGETHER_API_KEY>",
      title: "TogetherAI",
    },
    icon: "together.png",
    tags: [ModelTag["Requires API Key"], ModelTag["Open-Source"]],
  },
  {
    title: "Replicate",
    class: "ReplicateLLM",
    description: "",
    args: {
      model:
        "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781",
      api_key: "<REPLICATE_API_KEY>",
      title: "Replicate",
    },
    icon: "replicate.png",
    tags: [ModelTag["Requires API Key"], ModelTag["Open-Source"]],
  },
  {
    title: "llama.cpp",
    class: "LlamaCpp",
    description: "",
    args: {
      title: "llama.cpp",
    },
    icon: "llamacpp.png",
    tags: [ModelTag["Local"], ModelTag["Open-Source"]],
  },
  {
    title: "HuggingFace Inference API",
    class: "HuggingFaceInferenceAPI",
    description: "",
    args: {
      endpoint_url: "<INFERENCE_API_ENDPOINT_URL>",
      hf_token: "<HUGGING_FACE_TOKEN>",
      title: "HuggingFace Inference API",
    },
    icon: "hf.png",
    tags: [ModelTag["Requires API Key"], ModelTag["Open-Source"]],
  },
  {
    title: "LM Studio",
    class: "GGML",
    description: "",
    args: {
      server_url: "http://localhost:1234",
      title: "LM Studio",
    },
    icon: "lmstudio.png",
    tags: [ModelTag["Local"], ModelTag["Open-Source"]],
  },
  {
    title: "Other OpenAI-compatible API",
    class: "GGML",
    description: "",
    args: {
      server_url: "<SERVER_URL>",
    },
    icon: "openai.svg",
    tags: [ModelTag.Local, ModelTag["Open-Source"]],
  },
  {
    title: "GPT-4 limited free trial",
    class: "MaybeProxyOpenAI",
    description:
      "New users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key.",
    args: {
      model: "gpt-4",
      title: "GPT-4 Free Trial",
    },
    icon: "openai.svg",
    tags: [ModelTag.Free],
  },
];

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 2rem;
  padding: 1rem;
  justify-items: center;
  align-items: center;
`;

function Models() {
  const navigate = useNavigate();
  return (
    <div className="overflow-y-scroll">
      <div
        className="items-center flex m-0 p-0"
        style={{ borderBottom: `0.5px solid ${lightGray}` }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Models</h3>
      </div>
      <GridDiv>
        {MODEL_INFO.map((model) => (
          <ModelCard modelInfo={model} />
        ))}
      </GridDiv>
    </div>
  );
}

export default Models;
