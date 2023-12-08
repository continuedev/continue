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
} from "../../../core/llm/llms";
import { ModelDescription } from "../../../core/config";
import { LLM } from "../../../core/llm";

function modelDescriptionToLLM(desc: ModelDescription): LLM {
  let cls: typeof LLM;
  switch (desc.provider) {
    case "openai-free-trial":
      cls = FreeTrial;
      break;
    case "anthropic":
      cls = Anthropic;
      break;
    case "google-palm":
      cls = GooglePalm;
      break;
    case "lmstudio":
      cls = LMStudio;
      break;
    case "llamafile":
      cls = Llamafile;
      break;
    case "ollama":
      cls = Ollama;
      break;
    case "replicate":
      cls = Replicate;
      break;
    case "text-gen-webui":
      cls = TextGenWebUI;
      break;
    case "together":
      cls = Together;
      break;
    case "huggingface-tgi":
      cls = HuggingFaceTGI;
      break;
    case "huggingface-inference-api":
      cls = HuggingFaceInferenceAPI;
      break;
    case "llama.cpp":
      cls = LlamaCpp;
      break;
    case "openai-aiohttp":
    case "openai":
      cls = OpenAI;
      break;
    default:
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
