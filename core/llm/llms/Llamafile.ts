import type { ModelProvider } from "../..";
import LlamaCpp from "./LlamaCpp";

class Llamafile extends LlamaCpp {
  static providerName: ModelProvider = "llamafile";
}

export default Llamafile;
