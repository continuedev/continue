import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Asksage extends OpenAI {
    static providerName: ModelProvider = "ask-sage";
  
    static defaultOptions: Partial<LLMOptions> = {
      apiVersion: "2024-02-15-preview",
      apiType: "azure",
    };
  
    constructor(options: LLMOptions) {
      super(options);
      this.engine = options.model;
    }
  }
  
  export default Asksage;
  