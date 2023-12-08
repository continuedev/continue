import { ideRequest } from "./messaging";
import { IDE } from "./types";

class ExtensionIde implements IDE {
  async getSerializedConfig() {
    const resp = await ideRequest("getSerializedConfig", {});
    return resp.config;
  }
}
