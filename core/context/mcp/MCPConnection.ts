import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { fileURLToPath } from "url";

import {
  decodeSecretLocation,
  getTemplateVariables,
} from "@continuedev/config-yaml";
import {
  SSEClientTransport,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Agent as HttpsAgent } from "https";
import {
  IDE,
  InternalMcpOptions,
  InternalSseMcpOptions,
  InternalStdioMcpOptions,
  InternalStreamableHttpMcpOptions,
  InternalWebsocketMcpOptions,
  MCPConnectionStatus,
  MCPPrompt,
  MCPResource,
  MCPResourceTemplate,
  MCPServerStatus,
  MCPTool,
} from "../..";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getEnvPathFromUserShell } from "../../util/shellPath";
import { getOauthToken } from "./MCPOauth";

const DEFAULT_MCP_TIMEOUT = 20_000; // 20 seconds

// Commands that are batch scripts on Windows and need cmd.exe to execute
const WINDOWS_BATCH_COMMANDS = [
  "npx",
  "uv",
  "uvx",
  "pnpx",
  "dlx",
  "nx",
  "bunx",
];

const COMMONS_ENV_VARS = ["HOME", "USER", "USERPROFILE", "LOGNAME", "USERNAME"];

function is401Error(error: unknown) {
  return (
    (error instanceof SseError && error.code === 401) ||
    (error instanceof Error && error.message.includes("401")) ||
    (error instanceof Error && error.message.includes("Unauthorized"))
  );
}

export type MCPExtras = {
  ide: IDE;
};

class MCPConnection {
  public client: Client;
  public abortController: AbortController;
  public status: MCPConnectionStatus = "not-connected";
  public isProtectedResource = false;
  public errors: string[] = [];
  public infos: string[] = [];
  public prompts: MCPPrompt[] = [];
  public tools: MCPTool[] = [];
  public resources: MCPResource[] = [];
  public resourceTemplates: MCPResourceTemplate[] = [];
  private transport: Transport;
  private connectionPromise: Promise<unknown> | null = null;
  private stdioOutput: { stdout: string; stderr: string } = {
    stdout: "",
    stderr: "",
  };

  constructor(
    public options: InternalMcpOptions,
    public extras?: MCPExtras,
  ) {
    // Don't construct transport in constructor to avoid blocking
    this.transport = {} as Transport; // Will be set in connectClient

    this.client = new Client(
      {
        name: "continue-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    this.abortController = new AbortController();
  }

  async disconnect(disable = false) {
    this.abortController.abort();
    await this.client.close();
    await this.transport.close();
    this.status = disable ? "disabled" : "not-connected";
  }

  getStatus(): MCPServerStatus {
    return {
      ...this.options,
      errors: this.errors,
      infos: this.infos,
      prompts: this.prompts,
      resources: this.resources,
      resourceTemplates: this.resourceTemplates,
      tools: this.tools,
      status: this.status,
      isProtectedResource: this.isProtectedResource,
    };
  }

  async connectClient(forceRefresh: boolean, externalSignal: AbortSignal) {
    if (this.status === "disabled") {
      return;
    }
    if (!forceRefresh) {
      // Already connected
      if (this.status === "connected") {
        return;
      }

      // Connection is already in progress; wait for it to complete
      if (this.connectionPromise) {
        await this.connectionPromise;
        return;
      }
    }

    this.status = "connecting";
    this.tools = [];
    this.prompts = [];
    this.resources = [];
    this.resourceTemplates = [];
    this.errors = [];
    this.infos = [];
    this.stdioOutput = { stdout: "", stderr: "" };

    this.abortController.abort();
    this.abortController = new AbortController();

    // currently support oauth for sse transports only
    if (this.options.type === "sse") {
      if (!this.options.requestOptions) {
        this.options.requestOptions = {
          headers: {},
        };
      }
      const accessToken = await getOauthToken(
        this.options.url,
        this.extras?.ide!,
      );
      if (accessToken) {
        this.isProtectedResource = true;
        this.options.requestOptions.headers = {
          ...this.options.requestOptions.headers,
          Authorization: `Bearer ${accessToken}`,
        };
      }
    }

    const vars = getTemplateVariables(JSON.stringify(this.options));
    const unrendered = vars.map((v) => {
      const stripped = v.replace("secrets.", "");
      try {
        return decodeSecretLocation(stripped).secretName;
      } catch {
        return stripped;
      }
    });

    if (unrendered.length > 0) {
      this.errors.push(
        `${this.options.name} MCP Server has unresolved secrets: ${unrendered.join(", ")}.
For personal use you can set the secret in the hub at https://hub.continue.dev/settings/secrets.
Org-level secrets can only be used for MCP by Background Agents (https://docs.continue.dev/hub/agents/overview) when \"Include in Env\" is enabled.`,
      );
    }

    this.connectionPromise = Promise.race([
      // If aborted by a refresh or other, cancel and don't do anything
      new Promise((resolve) => {
        externalSignal.addEventListener("abort", () => {
          resolve(undefined);
        });
      }),
      new Promise((resolve) => {
        this.abortController.signal.addEventListener("abort", () => {
          resolve(undefined);
        });
      }),
      (async () => {
        const timeoutController = new AbortController();
        const connectionTimeout = setTimeout(
          () => timeoutController.abort(),
          this.options.timeout ?? DEFAULT_MCP_TIMEOUT,
        );

        try {
          await Promise.race([
            new Promise((_, reject) => {
              timeoutController.signal.addEventListener("abort", () => {
                reject(new Error("Connection timed out"));
              });
            }),
            (async () => {
              if ("command" in this.options) {
                // STDIO: no need to check type, just if command is present
                const transport = await this.constructStdioTransport(
                  this.options,
                );
                try {
                  await this.client.connect(transport, {});
                  this.transport = transport;
                } catch (error) {
                  // Allow the case where for whatever reason is already connected
                  if (
                    error instanceof Error &&
                    error.message.startsWith(
                      "StdioClientTransport already started",
                    )
                  ) {
                    await this.client.close();
                    await this.client.connect(transport);
                    this.transport = transport;
                  } else {
                    throw error;
                  }
                }
              } else {
                // SSE/HTTP: if type isn't explicit: try http and fall back to sse
                if (this.options.type === "sse") {
                  const transport = this.constructSseTransport(this.options);
                  await this.client.connect(transport, {});
                  this.transport = transport;
                } else if (this.options.type === "streamable-http") {
                  const transport = this.constructHttpTransport(this.options);
                  await this.client.connect(transport, {});
                  this.transport = transport;
                } else if (this.options.type === "websocket") {
                  const transport = this.constructWebsocketTransport(
                    this.options,
                  );
                  await this.client.connect(transport, {});
                  this.transport = transport;
                } else if (this.options.type) {
                  throw new Error(
                    `Unsupported transport type: ${this.options.type}`,
                  );
                } else {
                  try {
                    const transport = this.constructHttpTransport({
                      ...this.options,
                      type: "streamable-http",
                    });
                    await this.client.connect(transport, {});
                    this.transport = transport;
                  } catch (e) {
                    try {
                      const transport = this.constructSseTransport({
                        ...this.options,
                        type: "sse",
                      });
                      await this.client.connect(transport, {});
                      this.transport = transport;
                    } catch (e) {
                      throw new Error(
                        `MCP config with URL and no type specified failed both SSE and HTTP connection: ${e instanceof Error ? e.message : String(e)}`,
                      );
                    }
                  }
                }
              }

              // TODO register server notification handlers
              // this.client.transport?.onmessage(msg => console.log())
              // this.client.setNotificationHandler(, notification => {
              //   console.log(notification)
              // })
              const capabilities = this.client.getServerCapabilities();

              // Resources <—> Context Provider
              if (capabilities?.resources) {
                try {
                  const { resources } = await this.client.listResources(
                    {},
                    { signal: timeoutController.signal },
                  );
                  this.resources = resources;
                } catch (e) {
                  let errorMessage = `Error loading resources for MCP Server ${this.options.name}`;
                  if (e instanceof Error) {
                    errorMessage += `: ${e.message}`;
                  }
                  this.errors.push(errorMessage);
                }

                // Resource templates
                try {
                  const { resourceTemplates } =
                    await this.client.listResourceTemplates(
                      {},
                      { signal: timeoutController.signal },
                    );

                  this.resourceTemplates = resourceTemplates;
                } catch (e) {
                  let errorMessage = `Error loading resource templates for MCP Server ${this.options.name}`;
                  if (e instanceof Error) {
                    errorMessage += `: ${e.message}`;
                  }
                  this.errors.push(errorMessage);
                }
              }

              // Tools <—> Tools
              if (capabilities?.tools) {
                try {
                  const { tools } = await this.client.listTools(
                    {},
                    { signal: timeoutController.signal },
                  );
                  this.tools = tools;
                } catch (e) {
                  let errorMessage = `Error loading tools for MCP Server ${this.options.name}`;
                  if (e instanceof Error) {
                    errorMessage += `: ${e.message}`;
                  }
                  this.errors.push(errorMessage);
                }
              }

              // Prompts <—> Slash commands
              if (capabilities?.prompts) {
                try {
                  const { prompts } = await this.client.listPrompts(
                    {},
                    { signal: timeoutController.signal },
                  );
                  this.prompts = prompts;
                } catch (e) {
                  let errorMessage = `Error loading prompts for MCP Server ${this.options.name}`;
                  if (e instanceof Error) {
                    errorMessage += `: ${e.message}`;
                  }
                  this.errors.push(errorMessage);
                }
              }

              this.status = "connected";
            })(),
          ]);
        } catch (error) {
          // Otherwise it's a connection error
          let errorMessage = `Failed to connect to "${this.options.name}"\n`;
          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes("spawn") && msg.includes("enoent")) {
              const command = msg.split(" ")[1];
              errorMessage += `Error: command "${command}" not found. To use this MCP server, install the ${command} CLI.`;
              if (["uv", "uvx"].includes(command)) {
                this.infos.push(
                  'Please install uv by following the installation guide: <a href="https://docs.astral.sh/uv/getting-started/installation/">https://docs.astral.sh/uv/getting-started/installation/</a>',
                );
              }
              if (["node", "npx"].includes(command)) {
                this.infos.push(
                  'Please install npx by following the installation guide: <a href="https://docs.npmjs.com/downloading-and-installing-node-js-and-npm">https://docs.npmjs.com/downloading-and-installing-node-js-and-npm</a>',
                );
              }
            } else {
              errorMessage += "Error: " + error.message;
            }
          }

          if (is401Error(error)) {
            this.isProtectedResource = true;
          }

          // Include stdio output if available for stdio transport
          if (
            this.options.type === "stdio" &&
            (this.stdioOutput.stdout || this.stdioOutput.stderr)
          ) {
            errorMessage += "\n\nProcess output:";
            if (this.stdioOutput.stdout) {
              errorMessage += `\nSTDOUT:\n${this.stdioOutput.stdout}`;
            }
            if (this.stdioOutput.stderr) {
              errorMessage += `\nSTDERR:\n${this.stdioOutput.stderr}`;
            }
          }

          this.status = "error";
          this.errors.push(errorMessage);
        } finally {
          this.connectionPromise = null;
          clearTimeout(connectionTimeout);
        }
      })(),
    ]);

    await this.connectionPromise;
  }

  /**
   * Resolves the command and arguments for the current platform
   * On Windows, batch script commands need to be executed via cmd.exe
   * @param originalCommand The original command
   * @param originalArgs The original command arguments
   * @returns An object with the resolved command and arguments
   */
  private resolveCommandForPlatform(
    originalCommand: string,
    originalArgs: string[],
  ): { command: string; args: string[] } {
    // If not on Windows or not a batch command, return as-is
    if (
      process.platform !== "win32" ||
      !WINDOWS_BATCH_COMMANDS.includes(originalCommand)
    ) {
      return { command: originalCommand, args: originalArgs };
    }

    // On Windows, we need to execute batch commands via cmd.exe
    // Format: cmd.exe /c command [args]
    return {
      command: "cmd.exe",
      args: ["/c", originalCommand, ...originalArgs],
    };
  }

  /**
   * Resolves the current working directory of the current workspace.
   * @param cwd The cwd parameter provided by user.
   * @returns Current working directory (user-provided cwd or workspace root).
   */
  private async resolveCwd(cwd?: string) {
    if (!cwd) {
      return this.resolveWorkspaceCwd(undefined);
    }

    if (cwd.startsWith("file://")) {
      return fileURLToPath(cwd);
    }

    // Return cwd if cwd is an absolute path.
    if (cwd.charAt(0) === "/") {
      return cwd;
    }

    return this.resolveWorkspaceCwd(cwd);
  }

  private async resolveWorkspaceCwd(cwd: string | undefined) {
    const IDE = this.extras?.ide;
    if (IDE) {
      const target = cwd ?? ".";
      const resolved = await resolveRelativePathInDir(target, IDE);
      if (resolved) {
        if (resolved.startsWith("file://")) {
          return fileURLToPath(resolved);
        }
        return resolved;
      }
      return resolved;
    }
    return cwd;
  }

  private constructWebsocketTransport(
    options: InternalWebsocketMcpOptions,
  ): WebSocketClientTransport {
    return new WebSocketClientTransport(new URL(options.url));
  }

  private constructSseTransport(
    options: InternalSseMcpOptions,
  ): SSEClientTransport {
    const sseAgent =
      options.requestOptions?.verifySsl === false
        ? new HttpsAgent({ rejectUnauthorized: false })
        : undefined;

    // Merge apiKey into headers if provided
    const headers = {
      ...options.requestOptions?.headers,
      ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }),
    };

    return new SSEClientTransport(new URL(options.url), {
      eventSourceInit: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              ...headers,
            },
            ...(sseAgent && { agent: sseAgent }),
          }),
      },
      requestInit: {
        headers,
        ...(sseAgent && { agent: sseAgent }),
      },
    });
  }

  private constructHttpTransport(
    options: InternalStreamableHttpMcpOptions,
  ): StreamableHTTPClientTransport {
    const { url, requestOptions } = options;
    const streamableAgent =
      requestOptions?.verifySsl === false
        ? new HttpsAgent({ rejectUnauthorized: false })
        : undefined;

    // Merge apiKey into headers if provided
    const headers = {
      ...requestOptions?.headers,
      ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }),
    };

    return new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers,
        ...(streamableAgent && { agent: streamableAgent }),
      },
    });
  }

  private async constructStdioTransport(
    options: InternalStdioMcpOptions,
  ): Promise<StdioClientTransport> {
    const commonEnvVars: Record<string, string> = Object.fromEntries(
      COMMONS_ENV_VARS.filter((key) => process.env[key] !== undefined).map(
        (key) => [key, process.env[key] as string],
      ),
    );

    const env = {
      ...commonEnvVars,
      ...(options.env ?? {}),
    };

    if (process.env.PATH !== undefined) {
      // Set the initial PATH from process.env
      env.PATH = process.env.PATH;

      // For non-Windows platforms, try to get the PATH from user shell
      if (process.platform !== "win32") {
        try {
          const shellEnvPath = await getEnvPathFromUserShell();
          if (shellEnvPath && shellEnvPath !== process.env.PATH) {
            env.PATH = shellEnvPath;
          }
        } catch (err) {
          console.error("Error getting PATH:", err);
        }
      }
    }

    const { command, args } = this.resolveCommandForPlatform(
      options.command,
      options.args || [],
    );

    const cwd = await this.resolveCwd(options.cwd);

    const transport = new StdioClientTransport({
      command,
      args,
      env,
      cwd,
      stderr: "pipe",
    });

    // Capture stdio output for better error reporting
    transport.stderr?.on("data", (data: Buffer) => {
      this.stdioOutput.stderr += data.toString();
    });

    return transport;
  }
}

export default MCPConnection;
