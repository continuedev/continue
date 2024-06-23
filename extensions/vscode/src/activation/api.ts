import { IContextProvider } from "core";
import { VsCodeExtension } from "../extension/vscodeExtension";

export class VsCodeContinueApi {
  constructor(private readonly vscodeExtension: VsCodeExtension) {}

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.vscodeExtension.registerCustomContextProvider(contextProvider);
  }
}
