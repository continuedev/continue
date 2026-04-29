import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";
import Perplexity from "./Perplexity.js";

createOpenAISubclassTests(Perplexity, {
  providerName: "perplexity",
  defaultApiBase: "https://api.perplexity.ai/",
});
