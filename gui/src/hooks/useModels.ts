import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import FreeTrial from "../../../core/llm/llms/FreeTrial";
import { ModelDescription } from "../../../core/config";
import { LLM } from "../../../core/llm";

function modelDescriptionToLLM(desc: ModelDescription): LLM {
  switch (desc.provider) {
    case "openai-free-trial":
      return new FreeTrial({ ...desc, uniqueId: "None" });
    case "anthropic":
      break;
    case "google-palm":
      break;
    case "lmstudio":
      break;
    case "llamafile":
      break;
    case "ollama":
      break;
    case "replicate":
      break;
    case "text-gen-webui":
      break;
    case "together":
      break;
    case "huggingface-tgi":
      break;
    case "huggingface-inference-api":
      break;
    case "llama.cpp":
      break;
    case "openai":
      break;
    case "openai-aiohttp":
      break;
    default:
      throw new Error(`Unknown provider ${desc.provider}`);
  }
}

function useModels() {
  const [defaultModel, setDefaultModel] = useState<LLM>(
    new FreeTrial({ uniqueId: "None" })
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
