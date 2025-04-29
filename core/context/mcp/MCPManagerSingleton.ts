import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import {
  MCPOptions,
  MCPServerStatus,
  StdioOptions,
  TransportOptions,
} from "../..";
import MCPConnection from "./MCPConnection";

export class MCPManagerSingleton {
  private static instance: MCPManagerSingleton;

  public onConnectionsRefreshed?: () => void;
  public connections: Map<string, MCPConnection> = new Map();

  private abortController: AbortController = new AbortController();

  private constructor() {}

  public static getInstance(): MCPManagerSingleton {
    if (!MCPManagerSingleton.instance) {
      MCPManagerSingleton.instance = new MCPManagerSingleton();
    }
    return MCPManagerSingleton.instance;
  }

  createConnection(id: string, options: MCPOptions): MCPConnection {
    if (!this.connections.has(id)) {
      const connection = new MCPConnection(options);
      this.connections.set(id, connection);
      return connection;
    } else {
      return this.connections.get(id)!;
    }
  }

  getConnection(id: string) {
    return this.connections.get(id);
  }

  async removeConnection(id: string) {
    const connection = this.connections.get(id);
    if (connection) {
      await connection.client.close();
    }

    this.connections.delete(id);
  }

  setConnections(servers: MCPOptions[], forceRefresh: boolean) {
    let refresh = false;

    // Remove any connections that are no longer in config
    Array.from(this.connections.entries()).forEach(([id, connection]) => {
      if (
        !servers.find(
          // Refresh the connection if TransportOptions changed
          (s) =>
            s.id === id &&
            this.compareTransportOptions(
              connection.options.transport,
              s.transport,
            ),
        )
      ) {
        refresh = true;
        connection.abortController.abort();
        void connection.client.close();
        this.connections.delete(id);
      }
    });

    // Add any connections that are not yet in manager
    servers.forEach((server) => {
      if (!this.connections.has(server.id)) {
        refresh = true;
        this.connections.set(server.id, new MCPConnection(server));
      } else {
        const conn = this.connections.get(server.id);
        if (conn) {
          // We need to update it. Some attributes may have changed, such as name, faviconUrl, etc.
          conn.options = server;
        }
      }
    });

    // NOTE the id is made by stringifying the options
    if (refresh) {
      void this.refreshConnections(forceRefresh);
    }
  }

  private compareTransportOptions(
    a: TransportOptions,
    b: TransportOptions,
  ): boolean {
    if (a.type !== b.type) {
      return false;
    }
    if (a.type === "stdio" && b.type === "stdio") {
      return (
        a.command === b.command &&
        JSON.stringify(a.args) === JSON.stringify(b.args) &&
        this.compareEnv(a, b)
      );
    } else if (a.type !== "stdio" && b.type !== "stdio") {
      return a.url === b.url;
    }
    return false;
  }

  private compareEnv(a: StdioOptions, b: StdioOptions): boolean {
    const aEnv = a.env ?? {};
    const bEnv = b.env ?? {};
    const aKeys = Object.keys(aEnv);
    const bKeys = Object.keys(bEnv);

    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => aEnv[key] === bEnv[key])
    );
  }

  async refreshConnection(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP Connection ${serverId} not found`);
    }
    await connection.connectClient(true, this.abortController.signal);
    if (this.onConnectionsRefreshed) {
      this.onConnectionsRefreshed();
    }
  }

  async refreshConnections(force: boolean) {
    this.abortController.abort();
    this.abortController = new AbortController();
    await Promise.race([
      new Promise((resolve) => {
        this.abortController.signal.addEventListener("abort", () => {
          resolve(undefined);
        });
      }),
      (async () => {
        await Promise.all(
          Array.from(this.connections.values()).map(async (connection) => {
            await connection.connectClient(force, this.abortController.signal);
          }),
        );
        if (this.onConnectionsRefreshed) {
          this.onConnectionsRefreshed();
        }
      })(),
    ]);
  }

  getStatuses(): (MCPServerStatus & { client: Client })[] {
    return Array.from(this.connections.values()).map((connection) => ({
      ...connection.getStatus(),
      client: connection.client,
    }));
  }
}
