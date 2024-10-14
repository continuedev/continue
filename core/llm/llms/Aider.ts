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
import { countTokens } from "../countTokens.js";
import * as cp from 'child_process';
import * as process from 'process';
import { PearAICredentials } from "../../pearaiServer/PearAICredentials.js";
import { getHeaders } from "../../pearaiServer/stubs/headers.js";
import { execSync } from 'child_process';
import * as os from 'os';


export const AIDER_QUESTION_MARKER = "[Yes]\\:"
export const AIDER_END_MARKER = '─────────────────────────────────────'

class Aider extends BaseLLM {
  getCurrentDirectory: (() => Promise<string>) | null = null;
  static providerName: ModelProvider = "aider";
  static defaultOptions: Partial<LLMOptions> = {
    model: "pearai_model",
    contextLength: 8192,
    completionOptions: {
      model: "pearai_model",
      maxTokens: 2048,
    },
  };

  private aiderProcess: cp.ChildProcess | null = null;
  private aiderOutput: string = '';
  private credentials: PearAICredentials;

  constructor(options: LLMOptions) {
    super(options);
    if (options.getCurrentDirectory) {
      this.getCurrentDirectory = options.getCurrentDirectory;
    }
    this.credentials = new PearAICredentials(
      options.getCredentials,
      options.setCredentials || (async () => {})
    );
    console.log("Aider constructor called");
    this.startAiderChat(this.model, this.apiKey);
  }

  public setPearAIAccessToken(value: string | undefined): void {
    this.credentials.setAccessToken(value);
  }

  public setPearAIRefreshToken(value: string | undefined): void {
    this.credentials.setRefreshToken(value);
  }

  private getUserShell(): string {
    if (os.platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
  }

  private getUserPath(): string {
    try {
      let command: string;
      const shell = this.getUserShell();

      if (os.platform() === 'win32') {
        // For Windows, we'll use a PowerShell command
        command = 'powershell -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\') + \';\' + [Environment]::GetEnvironmentVariable(\'Path\', \'Machine\')"';
      } else {
        // For Unix-like systems (macOS, Linux)
        command = `${shell} -ilc 'echo $PATH'`;
      }

      return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Error getting user PATH:', error);
      return process.env.PATH || '';
    }
  }



  private async _getHeaders() {
    await this.credentials.checkAndUpdateCredentials();
    return {
      "Content-Type": "application/json",
      ...(await getHeaders()),
    };
  }

  private captureAiderOutput(data: Buffer): void {
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

  async startAiderChat(model: string, apiKey: string | undefined): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let currentDir: string;
      if (this.getCurrentDirectory) {
        currentDir = await this.getCurrentDirectory();
      } else {
        currentDir = "";
      }

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
            await this.credentials.checkAndUpdateCredentials();
            const accessToken = this.credentials.getAccessToken();
            command = `aider --openai-api-key ${accessToken} --openai-api-base http://localhost:8000/integrations/aider`;
            break;
      }

      const userPath = this.getUserPath();
      const userShell = this.getUserShell();
      console.log('User PATH:', userPath);
      console.log('User shell:', userShell);

      let spawnArgs: string[];
      if (os.platform() === 'win32') {
        spawnArgs = ['/c', command];
      } else {
        spawnArgs = ['-c', command];
      }

      this.aiderProcess = cp.spawn(userShell, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: currentDir,
        env: {
          ...process.env,
          PATH: userPath, // Use the user's PATH here
        }
      });
        const spawnAiderProcess = () => {
          return cp.spawn(userShell, spawnArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: currentDir,
                env: {
                  ...process.env,
                      PATH: userPath,
                    }
                  });
        };

        try {
          this.aiderProcess = spawnAiderProcess();

          if (!this.aiderProcess.pid) {
            console.log('Aider not found. Attempting to install...');
            execSync('python -m pip install -U --upgrade-strategy only-if-needed aider-chat', { stdio: 'inherit' });
            console.log('Aider installed successfully. Retrying...');
            this.aiderProcess = spawnAiderProcess();
                }

          if (!this.aiderProcess.pid) {
            throw new Error('Failed to start Aider after installation');
              }
        } catch (error) {
          console.error('Failed to start or install Aider:', error);
          reject(error);
          return;
        }

      console.log('Spawned Aider process with PATH:', userPath);

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

  sendToAiderChat(message: string): void {
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
    this.sendToAiderChat(lastMessage);

    // Reset for new chat
    this.aiderOutput = '';

    let partialResponse = '';

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const newOutput = this.aiderOutput.slice(partialResponse.length);

      if (newOutput) {
        partialResponse += newOutput;
        yield {
          role: "assistant",
          content: newOutput,
        };

        // Check if newOutput includes AIDER_QUESTION_MARKER and send "Y" if it does
        if (newOutput.match(/\[\s*Y\s*e\s*s\s*\]\s*\\:/i)) {
          await new Promise(resolve => setTimeout(resolve, 300));
          this.sendToAiderChat("Y");
          continue
        }
      }

      if (this.aiderOutput.includes(AIDER_END_MARKER)) {
        break;
      }
    }

    // Reset the output after capturing a complete response
    this.aiderOutput = '';
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
