import { VsCodeExtension } from "./vscodeExtension";

export interface IVsCodeExtensionAPI {
  // For now, the internal VsCodeExtension will be exposed, enabling full access to the internal data.
  // Once it's clear, which functionality is most useful, we should design a proper API with limited access
  // and remove the instance here.
  instance: VsCodeExtension;
}
