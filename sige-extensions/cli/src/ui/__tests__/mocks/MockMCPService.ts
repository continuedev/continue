import { EMPTY_MCP_STATE, MCPService } from "../../../services/MCPService.js";

// Mock MCP Service
export class MockMCPService extends MCPService {
  constructor() {
    super();
  }
  getTools() {
    return [];
  }
  getPrompts() {
    return [];
  }
  async restartAllServers() {}
  async runTool() {
    return { content: [] };
  }
  getServerInfo() {
    return {
      config: {
        name: "example",
      },
      toolNames: [],
      promptNames: [],
      warnings: [],
      status: "connected" as const,
    };
  }

  async doInitialize() {
    return { ...EMPTY_MCP_STATE };
  }

  async stopServer() {}
  async restartServer() {}

  async cleanup() {}
}
