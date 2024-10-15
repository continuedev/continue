import { llms } from "../util.js";
import { OsLlms } from "./os.js";

export const OllamaLlms = llms("ollama", OsLlms);
