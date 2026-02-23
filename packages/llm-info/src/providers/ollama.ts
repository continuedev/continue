import { ModelProvider } from "../types.js";
import { OsLlms } from "./os.js";

export const Ollama: ModelProvider = {
  models: OsLlms,
  id: "ollama",
  displayName: "Ollama",
};
