import { RerankerName } from "../..";
import { FreeTrialReranker } from "./freeTrial";
import { LLMReranker } from "./llm";
import { VoyageReranker } from "./voyage";

export const AllRerankers: { [key in RerankerName]: any } = {
  llm: LLMReranker,
  voyage: VoyageReranker,
  "free-trial": FreeTrialReranker,
};
