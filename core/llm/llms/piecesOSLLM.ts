import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";
import * as Pieces from '@pieces.app/pieces-os-client';
import { QGPTApi, QGPTQuestionInput, QGPTStreamInput, QGPTRelevanceInput } from "pieces-os-client";
import { PiecesClient } from 'pieces-copilot-sdk';

class PiecesOSLLM extends BaseLLM {
  static providerName: ModelProvider = "pieces_os";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:1000", 
    model: "pieces_os",
  };

  client: QGPTApi;

  constructor(options: LLMOptions) {
    super(options);
    this.client = new QGPTApi({
      basePath: this.apiBase,
    });
    this.model = options.model || "pieces_os";
  }

  private _convertArgs(options: CompletionOptions, prompt: string): QGPTQuestionInput {
    const relevanceInput: QGPTRelevanceInput = {
      query: prompt,
      options: {
        database: true,
      },
    };
  
}

export default PiecesOSLLM;
