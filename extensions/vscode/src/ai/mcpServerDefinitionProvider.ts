import { createHash } from "node:crypto";
import * as path from "node:path";

import type { InternalMcpOptions, MCPServerStatus } from "core";
import * as vscode from "vscode";

/** Must match contributes.mcpServerDefinitionProviders[].id in package.json. */
export const MCP_PROVIDER_ID = "continuous.mcpServers";

type ProvidedDefinition =
  vscode.McpStdioServerDefinition | vscode.McpHttpServerDefinition;

/**
 * Offers the MCP servers of the selected Continuous config to VS Code's own
 * chat and agents (including the Agents window), so they are configured once.
 *
 * Definitions are listed without credentials: VS Code caches the list. Env
 * values, API keys and headers are added in resolveMcpServerDefinition, which
 * VS Code calls just before it starts a server.
 */
export class ContinuedMcpServerDefinitionProvider implements vscode.McpServerDefinitionProvider<ProvidedDefinition> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this.changed.event;

  private servers: InternalMcpOptions[] = [];
  private enabled = true;

  /** Called when the config reloads. */
  update(statuses: MCPServerStatus[] | undefined) {
    const next = (statuses ?? []).filter(
      (s) => s.status !== "disabled" && toDefinition(s, false) !== undefined,
    );
    if (fingerprint(next) === fingerprint(this.servers)) return;
    this.servers = next;
    this.changed.fire();
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.changed.fire();
  }

  provideMcpServerDefinitions(): ProvidedDefinition[] {
    if (!this.enabled) return [];
    return this.servers.flatMap((s) => toDefinition(s, false) ?? []);
  }

  resolveMcpServerDefinition(
    server: ProvidedDefinition,
  ): ProvidedDefinition | undefined {
    const options = this.servers.find((s) => s.name === server.label);
    // A server removed from the config since it was listed is not started.
    return options ? toDefinition(options, true) : undefined;
  }

  dispose() {
    this.changed.dispose();
  }
}

/**
 * Translate a Continuous MCP server into a VS Code definition. Websocket servers
 * have no VS Code equivalent and are left out. `withSecrets` false leaves out
 * env values, API keys and request headers.
 */
export function toDefinition(
  server: InternalMcpOptions,
  withSecrets: boolean,
): ProvidedDefinition | undefined {
  const version = versionOf(server);
  if ("command" in server && server.command) {
    const def = new vscode.McpStdioServerDefinition(
      server.name,
      server.command,
      server.args ?? [],
      withSecrets ? { ...(server.env ?? {}) } : {},
      version,
    );
    if (server.cwd && path.isAbsolute(server.cwd)) {
      def.cwd = vscode.Uri.file(server.cwd);
    }
    return def;
  }
  if (
    "url" in server &&
    server.url &&
    server.type !== "websocket" &&
    /^https?:\/\//i.test(server.url)
  ) {
    const headers: Record<string, string> = {};
    if (withSecrets) {
      Object.assign(headers, server.requestOptions?.headers ?? {});
      if ("apiKey" in server && server.apiKey) {
        headers.Authorization = `Bearer ${server.apiKey}`;
      }
    }
    return new vscode.McpHttpServerDefinition(
      server.name,
      vscode.Uri.parse(server.url),
      headers,
      version,
    );
  }
  return undefined;
}

/**
 * Changes when anything about the server changes, credentials included, so VS
 * Code restarts it. Only a hash leaves this process.
 */
function versionOf(server: InternalMcpOptions): string {
  const { name, ...rest } = server as InternalMcpOptions & Record<string, any>;
  const relevant = {
    name,
    type: rest.type,
    command: rest.command,
    args: rest.args,
    env: rest.env,
    cwd: rest.cwd,
    url: rest.url,
    apiKey: rest.apiKey,
    headers: rest.requestOptions?.headers,
  };
  return createHash("sha256")
    .update(JSON.stringify(relevant))
    .digest("hex")
    .slice(0, 16);
}

function fingerprint(servers: InternalMcpOptions[]): string {
  return servers.map((s) => versionOf(s)).join(",");
}
