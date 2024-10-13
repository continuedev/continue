import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { SERVER_URL } from "../../util/parameters.js";
import { BaseLLM } from "../index.js";
import { streamSse, streamJSON } from "../stream.js";
import { checkTokens } from "../../db/token.js";
import { stripImages } from "../images.js";
import {
  countTokens,
} from "../countTokens.js";
import * as cp from 'child_process';

export const AIDER_QUESTION_MARKER = "[Yes]\\:"
export const AIDER_END_MARKER = '─────────────────────────────────────'

class Aider extends BaseLLM {
  static providerName: ModelProvider = "aider";
  static defaultOptions: Partial<LLMOptions> = {
    model: "pearai_model",
    contextLength: 8192,
    completionOptions: {
      model: "pearai_model",
      maxTokens: 2048,
    },
  };

  constructor(options: LLMOptions) {
    super(options);
    Aider.startAiderChat(this.model, this.apiKey);
  }

  private static aiderProcess: cp.ChildProcess | null = null;
  private static aiderOutput: string = '';

  static captureAiderOutput(data: Buffer): void {
    const lines = data.toString().replace(/\r\n|\r/g, '').split('\n');
    console.log("Before lines:", lines)
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\[\s*Y\s*e\s*s\s*\]\s*:\s*/i) && !lines[i].trim().endsWith(':')) {
        startIndex = i + 1;
        break;
      }
    }
    const filteredLines = lines.slice(startIndex).filter(line => {
      const trimmedLine = line.trim();
      return !trimmedLine.startsWith('>');
    }).map(line =>
      line.trim().replace(/[\\$&+,:;=?@#|'<>.^*()%!-]/g, '\\$&')
    );
    let filteredOutput = filteredLines.join("\n")
    this.aiderOutput += filteredOutput;
  }

  static startAiderChat(model: string, apiKey: string | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentDir = "/Users/nang/Documents/ebook-generator-site/"; // Todo: make this the dir that is currently open
      console.log("Current directory:", currentDir);

      let command: string;
      switch (model) {
        case "claude-3-5-sonnet-20240620":
          command = `export ANTHROPIC_API_KEY=${apiKey}; /opt/homebrew/bin/aider`;
          break;
        case "gpt-4o":
          command = `export OPENAI_API_KEY=${apiKey}; /opt/homebrew/bin/aider`;
          break;
        case "pearai_model":
        default:
          command = '/opt/homebrew/bin/aider --openai-api-key 8888 --openai-api-base http://localhost:8000/integrations/aider';
          break;
      }

      this.aiderProcess = cp.spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: currentDir,
        env: {
          ...process.env,
        }
      });

      if (this.aiderProcess.stdout && this.aiderProcess.stderr) {
        this.aiderProcess.stdout.on('data', (data: Buffer) => {
          console.log(`Aider output: ${data.toString()}`);
          this.captureAiderOutput(data);
        });

        this.aiderProcess.stderr.on('data', (data: Buffer) => {
          console.error(`Aider error: ${data.toString()}`);
        });

        this.aiderProcess.on('close', (code: number | null) => {
          console.log(`Aider process exited with code ${code}`);
          this.aiderProcess = null;
        });

        this.aiderProcess.on('error', (error: Error) => {
          console.error(`Error starting Aider: ${error.message}`);
          reject(error);
        });
      }

      resolve();
    });
  }

  static sendToAiderChat(message: string): void {
    if (this.aiderProcess && this.aiderProcess.stdin && !this.aiderProcess.killed) {
      this.aiderProcess.stdin.write(`${message}\n`);
    } else {
      console.error('Aider process is not running');
    }
  }

  private _convertArgs(options: CompletionOptions): any {
    return {
      model: options.model,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      max_tokens: options.maxTokens,
      stop: options.stop?.slice(0, 2),
      temperature: options.temperature,
      top_p: options.topP,
    };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      yield stripImages(chunk.content);
    }
  }

  countTokens(text: string): number {
    return countTokens(text, this.model);
  }

  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type === "text") {
          return part;
        }
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
      }),
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const args = this._convertArgs(this.collectArgs(options));
    console.log("HI inside Aider");

    const lastMessage = messages[messages.length - 1].content.toString();
    console.log(lastMessage);
    Aider.sendToAiderChat(lastMessage);

    // Reset for new chat
    Aider.aiderOutput = '';

    let partialResponse = '';

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const newOutput = Aider.aiderOutput.slice(partialResponse.length);

      if (newOutput) {
        partialResponse += newOutput;
        yield {
          role: "assistant",
          content: newOutput,
        };

        // Check if newOutput includes AIDER_QUESTION_MARKER and send "Y" if it does
        if (newOutput.match(/\[\s*Y\s*e\s*s\s*\]\s*\\:/i)) {
          await new Promise(resolve => setTimeout(resolve, 300));
          Aider.sendToAiderChat("Y");
          continue
        }
      }

      if (Aider.aiderOutput.includes(AIDER_END_MARKER)) {
        break;
      }
    }

    // Reset the output after capturing a complete response
    Aider.aiderOutput = '';
  }

  async listModels(): Promise<string[]> {
    return [
      "aider", "claude-3-5-sonnet-20240620", "pearai_model", "gpt-4o",
    ];
  }

  supportsFim(): boolean {
    return false;
  }
}

export default Aider;
