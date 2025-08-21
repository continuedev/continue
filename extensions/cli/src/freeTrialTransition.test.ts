import {
  isValidAnthropicApiKey,
  getApiKeyValidationError,
} from "./util/apiKeyValidation.js";

describe("Free Trial Transition API Key Validation", () => {
  it("should validate API keys properly for free trial transition", () => {
    // Valid API keys
    expect(isValidAnthropicApiKey("TEST-ant-1234567890")).toBe(true);
    expect(
      isValidAnthropicApiKey("TEST-ant-api03_T3BlbkFJ1234567890abcdef"),
    ).toBe(true);

    // Invalid API keys
    expect(isValidAnthropicApiKey("TEST-")).toBe(false);
    expect(isValidAnthropicApiKey("TEST-ant-")).toBe(false);
    expect(isValidAnthropicApiKey("TEST-openai-1234")).toBe(false);
    expect(isValidAnthropicApiKey("")).toBe(false);
    expect(isValidAnthropicApiKey(null)).toBe(false);
    expect(isValidAnthropicApiKey(undefined)).toBe(false);
  });

  it("should provide helpful error messages for invalid API keys", () => {
    expect(getApiKeyValidationError("")).toBe("API key is required");
    expect(getApiKeyValidationError(null)).toBe("API key is required");
    expect(getApiKeyValidationError(undefined)).toBe("API key is required");
    expect(getApiKeyValidationError("TEST-")).toBe(
      'API key must start with "TEST-ant-"',
    );
    expect(getApiKeyValidationError("TEST-openai-1234")).toBe(
      'API key must start with "TEST-ant-"',
    );
    expect(getApiKeyValidationError("TEST-ant-")).toBe("API key is too short");
    expect(getApiKeyValidationError("invalid")).toBe(
      'API key must start with "TEST-ant-"',
    );
  });
});
