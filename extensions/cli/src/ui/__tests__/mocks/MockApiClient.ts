// Mock API Client
export class MockApiClient {
<<<<<<< HEAD
  async getFreeTrialStatus() {
    return {
      optedInToFreeTrial: true,
      chatCount: 5,
      chatLimit: 100,
    };
  }
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
