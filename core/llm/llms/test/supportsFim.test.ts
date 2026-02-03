import { jest } from "@jest/globals";

// Mock the parseProxyModelName function
const mockParseProxyModelName = jest.fn();
jest.mock("@continuedev/config-yaml", () => ({
  parseProxyModelName: mockParseProxyModelName,
  decodeSecretLocation: jest.fn(),
  SecretType: { NotFound: "not-found" },
}));

// Test cases: [LLM class, model, expected supportsFim result, description]
const testCases: [any, string, boolean, string][] = [];

testCases.forEach(([LLMClass, model, expectedResult, description]) => {
  test(`supportsFim returns ${expectedResult} for ${description}`, () => {
    const llm = new LLMClass({
      model,
      apiKey: "test-key",
    });

    const result = llm.supportsFim();

    expect(result).toBe(expectedResult);
  });
});
