import React from "react";
import ModelCard, { ModelInfo, ModelTag } from "../components/ModelCard";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { lightGray, vscBackground } from "../components";
import { useNavigate } from "react-router-dom";

const MODEL_INFO: ModelInfo[] = [
  {
    title: "OpenAI",
    class: "OpenAI",
    description: "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model",
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
    description:
      "Claude-2 is a highly capable model with a 100k context length",
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
    description:
      "One of the fastest ways to get started with local models on Mac or Linux",
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
    description:
      "Use the TogetherAI API for extremely fast streaming of open-source models",
    args: {
      model: "togethercomputer/CodeLlama-13b-Instruct",
      api_key: "<TOGETHER_API_KEY>",
      title: "TogetherAI",
    },
    icon: "together.png",
    tags: [ModelTag["Requires API Key"], ModelTag["Open-Source"]],
  },
  {
    title: "LM Studio",
    class: "GGML",
    description:
      "One of the fastest ways to get started with local models on Mac or Windows",
    args: {
      server_url: "http://localhost:1234",
      title: "LM Studio",
    },
    icon: "lmstudio.png",
    tags: [ModelTag["Local"], ModelTag["Open-Source"]],
  },
  {
    title: "Replicate",
    class: "ReplicateLLM",
    description: "Use the Replicate API to run open-source models",
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
    description: "If you are running the llama.cpp server from source",
    args: {
      title: "llama.cpp",
    },
    icon: "llamacpp.png",
    tags: [ModelTag.Local, ModelTag["Open-Source"]],
  },
  {
    title: "HuggingFace TGI",
    class: "HuggingFaceTGI",
    description:
      "HuggingFace Text Generation Inference is an advanced, highly performant option for serving open-source models to multiple people",
    args: {
      title: "HuggingFace TGI",
    },
    icon: "hf.png",
    tags: [ModelTag.Local, ModelTag["Open-Source"]],
  },
  {
    title: "Other OpenAI-compatible API",
    class: "GGML",
    description:
      "If you are using any other OpenAI-compatible API, for example text-gen-webui, FastChat, LocalAI, or llama-cpp-python, you can simply enter your server URL",
    args: {
      server_url: "<SERVER_URL>",
    },
    icon: "openai.svg",
    tags: [ModelTag.Local, ModelTag["Open-Source"]],
  },
  {
    title: "GPT-4 limited free trial",
    class: "OpenAIFreeTrial",
    description:
      "New users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key",
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
        className="items-center flex m-0 p-0 sticky top-0"
        style={{
          borderBottom: `0.5px solid ${lightGray}`,
          backgroundColor: vscBackground,
          zIndex: 2,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Add a new model</h3>
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
