import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { homedir } from "os";
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
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
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
import {
  createWebFetch,
  defaultUseSystemCa,
  getTlsErrorHint,
  needsCustomAgent,
} from "@continuedev/fetch";
import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getEnvPathFromUserShell } from "../../util/shellPath";
import { nodeSupportsSystemCa, withSystemCaNodeOption } from "./stdioSystemCa";
import {
  DEFAULT_OAUTH_CALLBACK_PORT,
  MCPConnectionOauthProvider,
  createSignedInOauthProvider,
  getOauthCallbackUrl,
} from "./MCPOauth";

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

/**
 * Did the server answer 401? Looks at the status code the transports expose
 * (and at wrapped causes) rather than the message text, because servers answer
 * with bodies like "invalid_token" or "Invalid or expired token" that never
 * mention 401. The message check stays as a fallback for other transports.
 */
export function isUnauthorizedError(error: unknown): boolean {
  let current: any = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (
      current instanceof UnauthorizedError ||
      (current instanceof SseError && current.code === 401) ||
      (current instanceof StreamableHTTPError && current.code === 401) ||
      current.code === 401 ||
      current.status === 401 ||
      current.statusCode === 401
    ) {
      return true;
    }
    current = current.cause;
  }
  return (
    error instanceof Error &&
    (error.message.includes("401") || /unauthori[sz]ed/i.test(error.message))
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
  /** A request in the current connection attempt was answered with 401. */
  private sawUnauthorized = false;
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

    // Reconnecting (Refresh, or after signing in) must not leave the previous
    // transport attached: the SDK refuses a second connect() otherwise.
    try {
      await this.client.close();
    } catch {
      // nothing to close, or it was already closed
    }

    this.sawUnauthorized = false;
    // OAuth for SSE and streamable-http: if the user has signed in, hand the
    // SDK a provider so it sends the token and refreshes it when it expires.
    const authProvider = await this.getAuthProvider();

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
Set each one in ~/.continuous/.env, <workspace>/.continuous/.env or <workspace>/.env (NAME=value), or as an environment variable.`,
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
                  const transport = this.constructSseTransport(
                    this.options,
                    authProvider,
                  );
                  await this.client.connect(transport, {});
                  this.transport = transport;
                } else if (this.options.type === "streamable-http") {
                  const transport = this.constructHttpTransport(
                    this.options,
                    authProvider,
                  );
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
                    const transport = this.constructHttpTransport(
                      {
                        ...this.options,
                        type: "streamable-http",
                      },
                      authProvider,
                    );
                    await this.client.connect(transport, {});
                    this.transport = transport;
                  } catch (httpError) {
                    // Remember a 401 from the first attempt: the final error
                    // below is a plain Error that no longer carries the status.
                    if (isUnauthorizedError(httpError)) {
                      this.sawUnauthorized = true;
                    }
                    try {
                      const transport = this.constructSseTransport(
                        {
                          ...this.options,
                          type: "sse",
                        },
                        authProvider,
                      );
                      await this.client.connect(transport, {});
                      this.transport = transport;
                    } catch (e) {
                      if (isUnauthorizedError(e)) {
                        this.sawUnauthorized = true;
                      }
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

          const tlsHint = getTlsErrorHint(error);
          if (tlsHint) {
            errorMessage += `\n\n${tlsHint}`;
          }

          if (this.sawUnauthorized || isUnauthorizedError(error)) {
            this.isProtectedResource = true;
            this.infos.push(this.signInGuidance(!!authProvider));
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

  /** Where OAuth settings for this server live, if it is a remote one. */
  private get oauthSettings() {
    return "oauth" in this.options ? this.options.oauth : undefined;
  }

  /**
   * Provider for servers the user has signed in to. Undefined when there is no
   * stored sign-in (or no IDE to talk to), so a first connection never starts
   * OAuth on its own.
   */
  private async getAuthProvider(): Promise<
    MCPConnectionOauthProvider | undefined
  > {
    if (
      !("url" in this.options) ||
      this.options.type === "websocket" ||
      !this.extras?.ide
    ) {
      return undefined;
    }
    const provider = await createSignedInOauthProvider(
      this.options.url,
      this.extras.ide,
      { callbackPort: this.oauthSettings?.callbackPort },
    );
    if (provider) {
      this.isProtectedResource = true;
    }
    return provider;
  }

  private signInGuidance(hadSignIn: boolean): string {
    const callback = getOauthCallbackUrl(
      this.oauthSettings?.callbackPort ?? DEFAULT_OAUTH_CALLBACK_PORT,
    );
    return hadSignIn
      ? `Your sign-in to ${this.options.name} has expired or was revoked. Use Sign in to authenticate again. (OAuth callback: ${callback})`
      : `${this.options.name} requires sign-in. Use Sign in to authenticate. (OAuth callback: ${callback})`;
  }

  /**
   * Resolves the command and arguments for the current platform
   * On Windows, batch script commands need to be executed via cmd.exe
   * UNLESS we're connected to a WSL remote (where Linux commands should run)
   * @param originalCommand The original command
   * @param originalArgs The original command arguments
   * @returns An object with the resolved command and arguments
   */
  private async resolveCommandForPlatform(
    originalCommand: string,
    originalArgs: string[],
  ): Promise<{ command: string; args: string[] }> {
    // Check if we're on Windows host connected to WSL remote
    const ideInfo = await this.extras?.ide?.getIdeInfo();
    const isWindowsHostWithWslRemote =
      process.platform === "win32" && ideInfo?.remoteName === "wsl";

    // If not on Windows, or connected to WSL, or not a batch command, return as-is
    if (
      process.platform !== "win32" ||
      isWindowsHostWithWslRemote ||
      !WINDOWS_BATCH_COMMANDS.includes(originalCommand)
    ) {
      return { command: originalCommand, args: originalArgs };
    }

    // On Windows (local), we need to execute batch commands via cmd.exe
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
        // Remote URIs (e.g. vscode-remote://ssh-remote+host/path) cannot be
        // used as a local cwd for child_process.spawn(). When the extension
        // runs in the Local Extension Host on Windows while connected to a
        // remote workspace, fall back to the user's home directory.
        if (resolved.includes("://")) {
          return homedir();
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

  /**
   * A `fetch` that applies this server's `requestOptions` (proxy, CA bundle,
   * the OS certificate store, client certificate, `verifySsl`), or undefined
   * when the SDK's own networking is fine. Also used for OAuth discovery,
   * registration, token requests and sign-in.
   */
  getFetch(): ReturnType<typeof createWebFetch> | undefined {
    if (!("url" in this.options) || this.options.type === "websocket") {
      return undefined;
    }
    const requestOptions = this.options.requestOptions;
    if (
      !needsCustomAgent(this.options.url, requestOptions, defaultUseSystemCa())
    ) {
      return undefined;
    }
    return createWebFetch(requestOptions);
  }

  private constructSseTransport(
    options: InternalSseMcpOptions,
    authProvider?: MCPConnectionOauthProvider,
  ): SSEClientTransport {
    // Merge apiKey into headers if provided
    const headers = {
      ...options.requestOptions?.headers,
      ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }),
    };

    return new SSEClientTransport(new URL(options.url), {
      authProvider,
      fetch: this.getFetch(),
      requestInit: {
        headers,
      },
    });
  }

  private constructHttpTransport(
    options: InternalStreamableHttpMcpOptions,
    authProvider?: MCPConnectionOauthProvider,
  ): StreamableHTTPClientTransport {
    const { url, requestOptions } = options;

    // Merge apiKey into headers if provided
    const headers = {
      ...requestOptions?.headers,
      ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }),
    };

    return new StreamableHTTPClientTransport(new URL(url), {
      authProvider,
      fetch: this.getFetch(),
      requestInit: {
        headers,
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

    let env: Record<string, string> = {
      ...commonEnvVars,
      ...(options.env ?? {}),
    };

    if (process.env.PATH !== undefined) {
      // Set the initial PATH from process.env
      env.PATH = process.env.PATH;

      // For non-Windows platforms or WSL remotes, try to get the PATH from user shell
      const ideInfo = await this.extras?.ide?.getIdeInfo();
      const isWindowsHostWithWslRemote =
        process.platform === "win32" && ideInfo?.remoteName === "wsl";
      if (process.platform !== "win32" || isWindowsHostWithWslRemote) {
        try {
          const shellEnvPath = await getEnvPathFromUserShell(
            ideInfo?.remoteName,
          );
          if (shellEnvPath && shellEnvPath !== process.env.PATH) {
            env.PATH = shellEnvPath;
          }
        } catch (err) {
          console.error("Error getting PATH:", err);
        }
      }
    }

    // Node-based servers (npx ...) should trust the OS certificate store too,
    // as Continue does, or they fail behind a TLS-inspecting proxy. Only when
    // enabled (default on for Windows and macOS) and the node on PATH
    // understands the flag.
    const useSystemCa =
      options.requestOptions?.useSystemCa ?? defaultUseSystemCa();
    env = withSystemCaNodeOption(
      env,
      useSystemCa,
      useSystemCa ? await nodeSupportsSystemCa(env) : false,
    );

    const { command, args } = await this.resolveCommandForPlatform(
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

  async getResource(uri: string) {
    return await this.client.readResource(
      { uri },
      {
        timeout: this.options.timeout,
      },
    );
  }
}

export default MCPConnection;
