// Mock MCP Service
export class MockMCPService {
  connections = [];
  assistant = {} as any;
  getTools() {
    return [];
  }
  getPrompts() {
    return [];
  }
  async runTool() {
    return { result: "Mock result" };
  }
  async executeToolCall() {
    return { result: "Mock result" };
  }
  async close() {}
  isInitialized() {
    return true;
  }
}
