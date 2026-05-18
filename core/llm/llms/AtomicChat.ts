import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class AtomicChat extends OpenAI {
  static providerName = "atomic-chat";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://127.0.0.1:1337/v1/",
  };
}

export default AtomicChat;
