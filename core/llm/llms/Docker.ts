import { spawn } from "child_process";
import { LLMOptions, ModelInstaller } from "../../index.js";
import OpenAI from "./OpenAI.js";
import http from "http";

/**
 * Docker Model Runner provider
 *
 * Integrates with Docker Desktop's Model Runner feature (currently in beta)
 * that allows running local AI models through Docker.
 *
 * Docker Model Runner provides an OpenAI-compatible API endpoint, making it
 * easy to integrate with existing OpenAI-compatible code.
 *
 * More information at: https://docs.docker.com/desktop/features/model-runner/
 */
class Docker extends OpenAI implements ModelInstaller {
  static providerName = "docker";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "http://localhost:12434/engines/v1",
    model: "gemma3-4B-F4", // Default model
  };

  private modelMap: Record<string, string> = {
    // Map of "continue model name" to Docker model name
    // Models can be pulled using: docker model pull <model_name>
    "llama3.3-70b": "ai/llama3.3:70B-Q4_K_M",
    "smollm2-360M-F4": "ai/smollm2:360M-Q4_K_M",
    "smollm2-360M-F16": "ai/ai/smollm2:360M-F16",
    "qwen2.5-7B-F16": "ai/qwen2.5:7B-F16",
    "qwen2.5-7B-F4": "ai/qwen2.5:7B-Q4_K_M",
    "phi4-14B-F16": "ai/phi4:14B-F16",
    "phi4-14B-F4": "ai/phi4:14B-Q4_K_M",
    "mistral-7B-F16": "ai/mistral:7B-F16",
    "mistral-7B-F4": "ai/mistral:7B-Q4_K_M",
    "mistral-nemo-12B": "ai/mistral-nemo:12B-Q4_K_M",
    "gemma3-4B-F16": "ai/gemma3:4B-F16",
    "gemma3-4B-F4": "ai/gemma3:4B-Q4_K_M",
    "llama3.2-3B-F16": "ai/llama3.2:3B-F16",
    "llama3.2-3B-F4": "ai/llama3.2:3B-Q4_K_M",
    "llama3.2-1B-F16": "ai/llama3.2:1B-F16",
    "llama3.2-1B-F8": "ai/llama3.2:1B-Q8_0",
    "qwq-32B-F16": "ai/qwq:32B-F16",
    "qwq-32B-F4": "ai/qwq:32B-Q4_K_M",
    "deepseek-r1-distill-llama-70B-F4": "ai/deepseek-r1-distill-llama:70B-Q4_K_M",
    "deepseek-r1-distill-llama-8B-F16": "ai/deepseek-r1-distill-llama:8B-F16",
    "deepseek-r1-distill-llama-8B-Q4": "ai/deepseek-r1-distill-llama:8B-Q4_K_M"
  };

  constructor(options: LLMOptions) {
    super(options);

    // Handle model name mapping
    if (this.model && this.modelMap[this.model]) {
      this.model = this.modelMap[this.model];
    }
    
    // Check if Docker Model Runner is active and enable it if needed
    this.ensureModelRunnerEnabled();
  }

  /**
   * Checks if Docker Model Runner is running at the expected port
   * and enables it if not running
   */
  private async ensureModelRunnerEnabled(): Promise<void> {
    try {
      // Check if the Model Runner service is running on the expected port
      const isRunning = await this.isPortBound(12434);
      
      if (!isRunning) {
        console.log("Docker Model Runner not detected. Attempting to enable it...");
        await this.executeDockerCommand(['desktop', 'enable', 'model-runner', '--tcp', '12434']);
        console.log("Docker Model Runner has been enabled on port 12434");
      }
    } catch (error) {
      console.warn("Failed to enable Docker Model Runner:", error);
    }
  }

  /**
   * Checks if a port is currently bound/in use
   */
  private isPortBound(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request({
        method: 'HEAD',
        host: 'localhost',
        port: port,
        timeout: 1000,
        path: '/'
      }, () => {
        // If we can connect, the port is in use
        resolve(true);
      });

      req.on('error', () => {
        // If we can't connect, the port is not in use
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  private async executeDockerCommand(
    args: string[],
    signal?: AbortSignal
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', args, { shell: true });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Docker command failed with code ${code}: ${stderr}`));
        }
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          proc.kill();
          reject(new Error('Docker command was aborted'));
        });
      }
    });
  }

  async listModels(): Promise<string[]> {
    try {
      // Execute docker model ls and parse the output
      const { stdout } = await this.executeDockerCommand(['model', 'ls', '--format', '{{.Repository}}/{{.Tag}}']);
      return stdout.split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    } catch (error) {
      console.error("Failed to list Docker models:", error);
      return Object.values(this.modelMap);
    }
  }

  async installModel(
    modelName: string,
    signal: AbortSignal,
    progressReporter?: (task: string, increment: number, total: number) => void
  ): Promise<any> {
    const targetModel = this.modelMap[modelName] || modelName;

    try {
      // Report starting the installation
      progressReporter?.(`Installing Docker model ${targetModel}`, 0, 100);

      // Pull the model
      const { stdout, stderr } = await this.executeDockerCommand(['model', 'pull', targetModel], signal);

      // Report completion
      progressReporter?.(`Docker model ${targetModel} installed successfully`, 100, 100);

      return { success: true, stdout, stderr };
    } catch (error) {
      console.error(`Failed to install Docker model ${targetModel}:`, error);
      // Fix: Type check the error before accessing message property
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to install Docker model ${targetModel}: ${errorMessage}`);
    }
  }
}

export default Docker;