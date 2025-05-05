import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { MCPOptions, MCPServerStatus } from "../..";
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
      if (!servers.find((s) => s.id === id)) {
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
      }
    });

    // NOTE the id is made by stringifying the options
    if (refresh) {
      void this.refreshConnections(forceRefresh);
    }
  }

  async refreshConnection(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      console.warn(`MCP Connection ${serverId} not found, attempting to reload configs`);
      // 再ロードを試みる
      await this.refreshConnections(true);
      return;
    }
    await connection.connectClient(true, this.abortController.signal);
    if (this.onConnectionsRefreshed) {
      this.onConnectionsRefreshed();
    }
  }

  async refreshConnections(force: boolean) {
    this.abortController.abort();
    this.abortController = new AbortController();
    
    // デバッグモードの場合、デバッグ情報を充実させる
    if (process.env.NODE_ENV === "development") {
      console.log(`Refreshing MCP connections (force=${force})`);
      
      // 現在の接続を表示
      console.log(`Current connections: ${Array.from(this.connections.keys()).join(', ')}`);
      
      // manual-testing-sandboxの確認
      try {
        const path = require('path');
        const fs = require('fs');
        const os = require('os');
        
        // 可能性のあるパスを確認
        const possiblePaths = [
          path.join(process.cwd(), 'manual-testing-sandbox', '.continue', 'mcpServers', 'databricks.yaml'),
          path.join('C:\\continue-databricks-claude-3-7-sonnet', 'manual-testing-sandbox', '.continue', 'mcpServers', 'databricks.yaml'),
          path.join(os.homedir(), 'continue-databricks-claude-3-7-sonnet', 'manual-testing-sandbox', '.continue', 'mcpServers', 'databricks.yaml')
        ];
        
        console.log('Checking manual-testing-sandbox paths:');
        possiblePaths.forEach((p, i) => {
          const exists = fs.existsSync(p);
          console.log(`  [${i + 1}] ${p} - ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        });
      } catch (e) {
        console.error('Error checking manual-testing-sandbox:', e);
      }
    }
    
    await Promise.race([
      new Promise((resolve) => {
        this.abortController.signal.addEventListener("abort", () => {
          resolve(undefined);
        });
      }),
      (async () => {
        await Promise.all(
          Array.from(this.connections.values()).map(async (connection) => {
            try {
              await connection.connectClient(force, this.abortController.signal);
            } catch (error) {
              console.error(`Error connecting MCP client ${connection.getStatus().id}:`, error);
            }
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
