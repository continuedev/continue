import { RerankerName } from "../../index.js";
import { CohereReranker } from "./cohere.js";
import { FreeTrialReranker } from "./freeTrial.js";
import { LLMReranker } from "./llm.js";
import { VoyageReranker } from "./voyage.js";

export const AllRerankers: { [key in RerankerName]: any } = {
  cohere: CohereReranker,
  llm: LLMReranker,
  voyage: VoyageReranker,
  "free-trial": FreeTrialReranker,
};
