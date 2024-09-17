import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { BaseLLM } from "../index.js";
import * as Pieces from '@pieces.app/pieces-os-client';
import { QGPTApi, QGPTQuestionInput, QGPTStreamInput, QGPTRelevanceInput } from "pieces-os-client";
import { PiecesClient } from 'pieces-copilot-sdk';

class PiecesOSLLM extends BaseLLM {
  static providerName: ModelProvider = "pieces-os";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:1000", 
    model: "pieces-os",
  };

  client: QGPTApi;

  constructor(options: LLMOptions) {
    super(options);
    this.client = new QGPTApi({
      basePath: this.apiBase,
    });
    this.model = options.model || "pieces-os";
  }

  private _convertArgs(options: CompletionOptions, prompt: string): QGPTQuestionInput {
    const relevanceInput: QGPTRelevanceInput = {
      query: prompt,
      options: {
        database: true,
      },
    };

    return {
      relevant: { iterable: [] }, 
      query: prompt,
      application: this.model,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    try {
      const streamInput: QGPTStreamInput = {
        question: this._convertArgs(options, prompt),
      };

      const response = await this.client.qgptStreamRaw({ qGPTStreamInput: streamInput });
      const stream = await response.value();

      for await (const chunk of stream) {
        if (chunk.question && chunk.question.answers) {
          for (const answer of chunk.question.answers.iterable) {
            yield answer.text;
          }
        }
      }
    } catch (error) {
      console.error('Error streaming question:', error);
      yield 'Error streaming question';
    }
  }

  async _call(
    prompt: string,
    options: CompletionOptions,
  ): Promise<string> {
    try {
      const questionInput = this._convertArgs(options, prompt);
      const response = await this.client.questionRaw({ qGPTQuestionInput: questionInput });
      const result = await response.value();

      return result.answers && result.answers.iterable.length > 0
        ? result.answers.iterable[0].text
        : "";
    } catch (error) {
      console.error('Error asking question:', error);
      return 'Error asking question';
    }
  }

  setModel(modelName: string): void {
    this.model = modelName;
    console.log(`Model set to ${modelName}.`);
  }

  get _llmType(): string {
    return "pieces-os";
  }

  get _identifyingParams(): Record<string, any> {
    return { model: this.model };
  }
}

export default PiecesOSLLM;
