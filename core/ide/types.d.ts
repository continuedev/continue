import { SerializedContinueConfig } from "../types";

interface IDE {
  getSerializedConfig(): Promise<SerializedContinueConfig>;
}

export { IDE };
