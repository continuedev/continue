import ModelsLab from "./ModelsLab.js";
import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";

createOpenAISubclassTests(ModelsLab, {
  providerName: "modelslab",
  defaultApiBase: "https://modelslab.com/api/uncensored-chat/v1/",
});
