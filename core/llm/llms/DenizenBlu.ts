import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class DenizenBlu extends OpenAI {
  static providerName = "denizenblu";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://bluroute.denizenblu.com/v1",
  };
}

export default DenizenBlu;
