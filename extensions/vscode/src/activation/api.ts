import { VsCodeExtension } from "../extension/vscodeExtension";
import { IContextProvider } from "core";

export class VsCodeContinueApi {
  constructor(private readonly vscodeExtension: VsCodeExtension) {}

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.vscodeExtension.registerCustomContextProvider(contextProvider);
  }
}