import Bedrock from "../llm/llms/Bedrock";
import Cohere from "../llm/llms/Cohere";
import FreeTrial from "../llm/llms/FreeTrial";
import HuggingFaceTEI from "../llm/llms/HuggingFaceTEI";
import { LLMReranker } from "../llm/llms/llm";
import ContinueProxy from "../llm/llms/stubs/ContinueProxy";
import Voyage from "../llm/llms/Voyage";

export const AllRerankers: { [key: string]: any } = {
  cohere: Cohere,
  bedrock: Bedrock,
  llm: LLMReranker,
  voyage: Voyage,
  "free-trial": FreeTrial,
  "huggingface-tei": HuggingFaceTEI,
  "continue-proxy": ContinueProxy,
};
