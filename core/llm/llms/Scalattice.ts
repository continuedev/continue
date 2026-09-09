import OpenAI from "./OpenAI.js";

import type { LLMOptions } from "../../index.js";

class Scalattice extends OpenAI {
  static providerName = "scalattice";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.scalattice.cloud/v1/",
  };
}

export default Scalattice;
