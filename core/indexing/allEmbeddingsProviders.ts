import { ILLM } from "../index.js";
import Bedrock from "../llm/llms/Bedrock.js";
import Cohere from "../llm/llms/Cohere.js";
import DeepInfra from "../llm/llms/DeepInfra.js";
import FreeTrial from "../llm/llms/FreeTrial.js";
import FunctionNetwork from "../llm/llms/FunctionNetwork.js";
import Gemini from "../llm/llms/Gemini.js";
import HuggingFaceTEIEmbeddingsProvider from "../llm/llms/HuggingFaceTEI.js";
import LMStudio from "../llm/llms/LMStudio.js";
import Mistral from "../llm/llms/Mistral.js";
import NCompass from "../llm/llms/NCompass.js";
import Nebius from "../llm/llms/Nebius.js";
import Nvidia from "../llm/llms/Nvidia.js";
import Ollama from "../llm/llms/Ollama.js";
import OpenAI from "../llm/llms/OpenAI.js";
import OVHcloud from "../llm/llms/OVHcloud.js";
import SageMaker from "../llm/llms/SageMaker.js";
import Scaleway from "../llm/llms/Scaleway.js";
import SiliconFlow from "../llm/llms/SiliconFlow.js";
import ContinueProxy from "../llm/llms/stubs/ContinueProxy.js";
import TransformersJsEmbeddingsProvider from "../llm/llms/TransformersJsEmbeddingsProvider.js";
import VertexAI from "../llm/llms/VertexAI.js";
import Voyage from "../llm/llms/Voyage.js";
import WatsonX from "../llm/llms/WatsonX.js";

type EmbeddingsProviderConstructor = new (...args: any[]) => ILLM;

export const allEmbeddingsProviders: Record<
  string,
  EmbeddingsProviderConstructor
> = {
  sagemaker: SageMaker,
  bedrock: Bedrock,
  ollama: Ollama,
  "transformers.js": TransformersJsEmbeddingsProvider,
  openai: OpenAI,
  cohere: Cohere,
  "free-trial": FreeTrial,
  "function-network": FunctionNetwork,
  "huggingface-tei": HuggingFaceTEIEmbeddingsProvider,
  gemini: Gemini,
  "continue-proxy": ContinueProxy,
  deepinfra: DeepInfra,
  ncompass: NCompass,
  nvidia: Nvidia,
  ovhcloud: OVHcloud,
  voyage: Voyage,
  mistral: Mistral,
  nebius: Nebius,
  vertexai: VertexAI,
  watsonx: WatsonX,
  lmstudio: LMStudio,
  siliconflow: SiliconFlow,
  scaleway: Scaleway,
};
