import { ModelProvider } from "../types.js";
import { OpenAi } from "./openai.js";  

export const Azure: ModelProvider = {
  ...OpenAi,  // inherit models from OpenAI
  id: "azure",
  displayName: "Azure",
  extraParameters: [],
};
