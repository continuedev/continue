import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
} from "./apiKeyValidation.js";

describe("isValidAnthropicApiKey", () => {
  it("should return true for valid API keys", () => {
    expect(isValidAnthropicApiKey("sk-ant-1234567890")).toBe(true);
    expect(isValidAnthropicApiKey("sk-ant-abcdefghijklmnop")).toBe(true);
    expect(isValidAnthropicApiKey("sk-ant-test-key-with-dashes")).toBe(true);
    expect(
      isValidAnthropicApiKey("sk-ant-api03_T3BlbkFJ1234567890abcdef"),
    ).toBe(true);
  });

  it("should return false for invalid API keys", () => {
    expect(isValidAnthropicApiKey("")).toBe(false);
    expect(isValidAnthropicApiKey("sk-ant-")).toBe(false);
    expect(isValidAnthropicApiKey("TEST-")).toBe(false);
    expect(isValidAnthropicApiKey("TEST-openai-1234567890")).toBe(false);
    expect(isValidAnthropicApiKey("invalid-key")).toBe(false);
    expect(isValidAnthropicApiKey("1234567890")).toBe(false);
  });

  it("should return false for null or undefined", () => {
    expect(isValidAnthropicApiKey(null)).toBe(false);
    expect(isValidAnthropicApiKey(undefined)).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isValidAnthropicApiKey(123 as any)).toBe(false);
    expect(isValidAnthropicApiKey({} as any)).toBe(false);
    expect(isValidAnthropicApiKey([] as any)).toBe(false);
  });
});

describe("getApiKeyValidationError", () => {
  it("should return appropriate error messages", () => {
    expect(getApiKeyValidationError("")).toBe("API key is required");
    expect(getApiKeyValidationError(null)).toBe("API key is required");
    expect(getApiKeyValidationError(undefined)).toBe("API key is required");
    expect(getApiKeyValidationError("TEST-")).toBe(
      'API key must start with "sk-ant-"',
    );
    expect(getApiKeyValidationError("TEST-openai-1234")).toBe(
      'API key must start with "sk-ant-"',
    );
    expect(getApiKeyValidationError("sk-ant-")).toBe("API key is too short");
    expect(getApiKeyValidationError("invalid")).toBe(
      'API key must start with "sk-ant-"',
    );
  });
});
