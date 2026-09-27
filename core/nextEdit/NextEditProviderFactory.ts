import { NEXT_EDIT_MODELS } from "../llm/constants.js";
import { BaseNextEditModelProvider } from "./providers/BaseNextEditProvider.js";
import { GenericNextEditProvider } from "./providers/GenericNextEditProvider.js";
import { InstinctProvider } from "./providers/InstinctNextEditProvider.js";
import { MercuryCoderProvider } from "./providers/MercuryCoderNextEditProvider.js";

export class NextEditProviderFactory {
  static createProvider(modelName: string): BaseNextEditModelProvider {
    if (modelName.includes(NEXT_EDIT_MODELS.MERCURY_CODER)) {
      return new MercuryCoderProvider();
    } else if (modelName.includes(NEXT_EDIT_MODELS.INSTINCT)) {
      return new InstinctProvider();
    }

    return new GenericNextEditProvider(modelName);
  }
}
