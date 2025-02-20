/**
 * Commiter AI - Custom Model for Commit Message Generation
 *
 * This model is built on the OpenAI-compatible framework used in this project.
 * It is specifically designed to generate concise commit messages based on code changes.
 * 
 * 🚨 DISCLAIMER:
 * - This is NOT an official Mistral AI model.
 * - It does NOT use any proprietary Mistral AI data, models, or APIs beyond standard OpenAI-compatible endpoints.
 * - The "Commiter AI" name is an internal designation and is not affiliated with Mistral AI.
 * 
 * License: This code follows the same open-source license as the main repository.
 * See LICENSE file for details.
 */

import { ChatMessage, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class CommiterAI extends OpenAI {
  static providerName = "codestral-commiter-ai";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.codestral.ai/v1/",
    model: "codestral-commiter-latest",
    promptTemplates: {
      systemMessage:
        "I will provide you with a change snippet and a full source file. Your task is to give me an appropriate short commit message that explain the changes. Output only the commit message, with no explanations or additional text. Commit message should be 10 words long max."
    },
    maxEmbeddingBatchSize: 128,
  };

  constructor(options: LLMOptions) {
    super(options);
    if (!this.apiBase?.endsWith("/")) {
      this.apiBase += "/";
    }
    this.openaiAdapter = this.createOpenAiAdapter();
  }

  protected _convertModelName(model: string): string {
    return model;
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = super._convertArgs(options, messages);
    return finalOptions;
  }

  supportsFim(): boolean {
    return true;
  }
}

export default CommiterAI;