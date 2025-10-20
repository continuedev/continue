import { OpenAIConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

export interface StakdConfig extends OpenAIConfig {}

export class StakdApi extends OpenAIApi {
  constructor(config: StakdConfig) {
    super({
      ...config,
      apiBase: "http://localhost:8080/v1/",
    });
  }
}

export default StakdApi;
