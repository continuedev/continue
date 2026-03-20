// Mock API Client
export class MockApiClient {
  async listAssistants() {
    return [];
  }
  async getAssistant() {
    // Return a minimal assistant config
    return {
      configResult: {
        config: {
          name: "test-assistant",
          models: [
            {
              provider: "openai",
              name: "test-model",
              model: "test-model",
            },
          ],
          systemMessage: "You are a helpful assistant",
          tools: [],
          mcpServers: [],
        },
      },
    };
  }
  async listOrganizations() {
    return { organizations: [] };
  }
  async syncSecrets() {
    return [];
  }
}
