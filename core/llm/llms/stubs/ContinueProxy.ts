import { ModelProvider } from "../../..";
import OpenAI from "../OpenAI";

class ContinueProxy extends OpenAI {
  static providerName: ModelProvider = "continue-proxy";
}

export default ContinueProxy;
