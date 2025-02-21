import { ContextProviderDescription } from "../../index.js";
import RemoteServerContextProvider from "./RemoteContextProvider.js";

// Deprecated - move to Remote Context Provider
class HttpContextProvider extends RemoteServerContextProvider {
  static description: ContextProviderDescription = {
    title: "http",
    displayTitle: "Remote Server",
    description: "Retrieve a context item from a custom server",
    type: "normal",
    renderInlineAs: "",
  };
}

export default HttpContextProvider;
