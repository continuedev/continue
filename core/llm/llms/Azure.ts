import { ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Azure extends OpenAI {
  static providerName: ModelProvider = "azure";
}

export default Azure;
