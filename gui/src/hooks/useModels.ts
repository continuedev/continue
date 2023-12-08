import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import {
  FreeTrial,
  Anthropic,
  GooglePalm,
  LMStudio,
  Llamafile,
  Ollama,
  Replicate,
  TextGenWebUI,
  Together,
  HuggingFaceTGI,
  HuggingFaceInferenceAPI,
  LlamaCpp,
  OpenAI,
} from "core/llm/llms";
import { ModelDescription } from "core/config";
import { LLM } from "core/llm";

function modelDescriptionToLLM(desc: ModelDescription): LLM {
  let cls: typeof LLM;
  const providerClasses = {
    "openai-free-trial": FreeTrial,
    anthropic: Anthropic,
    "google-palm": GooglePalm,
    lmstudio: LMStudio,
    llamafile: Llamafile,
    ollama: Ollama,
    replicate: Replicate,
    "text-gen-webui": TextGenWebUI,
    together: Together,
    "huggingface-tgi": HuggingFaceTGI,
    "huggingface-inference-api": HuggingFaceInferenceAPI,
    "llama.cpp": LlamaCpp,
    "openai-aiohttp": OpenAI,
    openai: OpenAI,
  };

  cls = providerClasses[desc.provider];

  if (!cls) {
    throw new Error(`Unknown provider ${desc.provider}`);
  }

  return new (cls as any)({ ...desc, uniqueId: "None" });
}

function useModels() {
  const [defaultModel, setDefaultModel] = useState<LLM>(
    new FreeTrial({ uniqueId: "None", model: "gpt-3.5-turbo" })
  );
  const models = useSelector((store: RootStore) => store.state.config.models);
  const defaultTitle = useSelector(
    (store: RootStore) => store.state.config.modelRoles.default
  );

  useEffect(() => {
    const model = models.find((model) => model.title === defaultTitle);
    if (model) {
      setDefaultModel(modelDescriptionToLLM(model));
    }
  }, [models, defaultTitle]);

  return { defaultModel };
}

export default useModels;
