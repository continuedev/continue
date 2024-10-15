import { llms } from "../util.js";
import { OsLlms } from "./os.js";

export const vllmLlms = llms("vllm", OsLlms);
