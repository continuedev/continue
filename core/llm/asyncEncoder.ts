import llamaTokenizer from "./llamaTokenizer.js";
import { Tiktoken, encodingForModel as _encodingForModel } from "js-tiktoken";
import workerpool from "workerpool";
import * as path from "path";

export interface AsyncEncoder {
  encode(text: string): Promise<number[]>;
  decode(tokens: number[]): string;
}

export class LlamaAsyncEncoder implements AsyncEncoder {
  private workerPool: workerpool.Pool;

  constructor() {
    this.workerPool = workerpool.pool(path.join(__dirname, "/llamaTokenizerWorkerPool.mjs"));
  }

  async encode(text: string): Promise<number[]> {
    return this.workerPool.exec("encode", [text]);
  }

  decode(tokens: number[]): string {
    return llamaTokenizer.decode(tokens);
  }

  // TODO: this should be called somewhere before exit or potentially with a shutdown hook
  public async close(): Promise<void> {
    await this.workerPool.terminate();
  }
}

// this class does not yet do anything asynchronous
export class GPTAsyncEncoder implements AsyncEncoder {
  private tiktokenEncoding: Tiktoken;

  constructor() {
    this.tiktokenEncoding = _encodingForModel("gpt-4");
  }

  async encode(text: string): Promise<number[]> {
    return this.tiktokenEncoding.encode(text, "all", []);
  }

  decode(tokens: number[]): string {
    return this.tiktokenEncoding.decode(tokens);
  }
}