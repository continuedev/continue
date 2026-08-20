import { SparkConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

export const SPARK_API_BASE = "https://spark-api-open.xf-yun.com/v1/";

export class SparkApi extends OpenAIApi {
  constructor(config: SparkConfig) {
    super({
      ...config,
      provider: "openai",
      apiBase: config.apiBase ?? SPARK_API_BASE,
    });
  }
}
