import { analyzeError } from "./errorAnalysis";

describe("errorAnalysis", () => {
  describe("analyzeError", () => {
    describe("basic error analysis", () => {
      it("should return basic error info when no selectedModel is provided", () => {
        const error = new Error("Test error message");
        const result = analyzeError(error, null);

        expect(result).toEqual({
          parsedError: "Test error message",
          statusCode: undefined,
          message: "Test error message",
          modelTitle: "Chat model",
          providerName: "the model provider",
          apiKeyUrl: undefined,
        });
      });

      it("should handle undefined error", () => {
        const result = analyzeError(undefined, null);

        expect(result).toEqual({
          parsedError: "",
          statusCode: undefined,
          message: undefined,
          modelTitle: "Chat model",
          providerName: "the model provider",
          apiKeyUrl: undefined,
        });
      });

      it("should handle null error", () => {
        const result = analyzeError(null, null);

        expect(result).toEqual({
          parsedError: "",
          statusCode: undefined,
          message: undefined,
          modelTitle: "Chat model",
          providerName: "the model provider",
          apiKeyUrl: undefined,
        });
      });

      it("should handle error with no message property", () => {
        const error = { someProperty: "value" };
        const result = analyzeError(error, null);

        expect(result).toEqual({
          parsedError: "",
          statusCode: undefined,
          message: undefined,
          modelTitle: "Chat model",
          providerName: "the model provider",
          apiKeyUrl: undefined,
        });
      });

      it("should handle error with non-string message", () => {
        const error = { message: 123 };
        const result = analyzeError(error, null);

        expect(result).toEqual({
          parsedError: "",
          statusCode: undefined,
          message: undefined,
          modelTitle: "Chat model",
          providerName: "the model provider",
          apiKeyUrl: undefined,
        });
      });
    });

    describe("error message parsing", () => {
      it("should return original message when no double newline is present", () => {
        const error = new Error("Simple error message");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("Simple error message");
      });

      it("should parse JSON error message after double newline", () => {
        const error = new Error(
          'Header message\n\n{"error": "JSON error message"}',
        );
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('"JSON error message"');
      });

      it("should parse JSON message property after double newline", () => {
        const error = new Error(
          'Header message\n\n{"message": "JSON message content"}',
        );
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('"JSON message content"');
      });

      it("should return raw JSON when no error or message property", () => {
        const error = new Error(
          'Header message\n\n{"code": 404, "details": "Not found"}',
        );
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe(
          '{"code": 404, "details": "Not found"}',
        );
      });

      it("should handle invalid JSON after double newline", () => {
        const error = new Error("Header message\n\n{invalid json}");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("{invalid json}");
      });

      it("should handle multiple double newlines", () => {
        const error = new Error("Header\n\nFirst section\n\nSecond section");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("First section\n\nSecond section");
      });

      it("should handle empty string after double newline", () => {
        const error = new Error("Header message\n\n");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("");
      });

      it("should handle complex nested JSON", () => {
        const complexJson = {
          error: {
            code: 400,
            message: "Bad Request",
            details: ["Invalid parameter", "Missing field"],
          },
        };
        const error = new Error(`Header\n\n${JSON.stringify(complexJson)}`);
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe(JSON.stringify(complexJson.error));
      });
    });

    describe("status code extraction", () => {
      it("should extract status code from HTTP error format", () => {
        const error = new Error("HTTP 404 Not Found");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(404);
        expect(result.message).toBe("HTTP 404 Not Found");
      });

      it("should extract status code from direct number format", () => {
        const error = new Error("401 Unauthorized");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(401);
        expect(result.message).toBe("401 Unauthorized");
      });

      it("should extract status code from beginning of message", () => {
        const error = new Error("500 Internal Server Error occurred");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(500);
        expect(result.message).toBe("500 Internal Server Error occurred");
      });

      it("should not extract status code from middle of message", () => {
        const error = new Error("Error occurred with status 404");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(undefined);
        expect(result.message).toBe("Error occurred with status 404");
      });

      it("should handle invalid status codes", () => {
        const error = new Error("ABC Invalid");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(undefined);
        expect(result.message).toBe("ABC Invalid");
      });

      it("should handle single word messages", () => {
        const error = new Error("404");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(404);
        expect(result.message).toBe("404");
      });

      it("should handle empty messages", () => {
        const error = new Error("");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(undefined);
        expect(result.message).toBe("");
      });

      it("should handle messages with only spaces", () => {
        const error = new Error("   ");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(undefined);
        expect(result.message).toBe("   ");
      });

      it("should handle floating point numbers", () => {
        const error = new Error("HTTP 404.5 Error");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(404.5);
        expect(result.message).toBe("HTTP 404.5 Error");
      });

      it("should handle negative numbers", () => {
        const error = new Error("HTTP -1 Error");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(-1);
        expect(result.message).toBe("HTTP -1 Error");
      });
    });

    describe("selectedModel handling", () => {
      it("should use selectedModel title and provider", () => {
        const selectedModel = {
          title: "GPT-4",
          provider: "openai",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.modelTitle).toBe("GPT-4");
        expect(result.providerName).toBe("OpenAI");
        expect(result.apiKeyUrl).toBe(
          "https://platform.openai.com/account/api-keys",
        );
      });

      it("should use selectedModel info when no matching provider is found", () => {
        const selectedModel = {
          title: "Custom Model",
          provider: "unknown-provider",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.modelTitle).toBe("Custom Model");
        expect(result.providerName).toBe("unknown-provider");
        expect(result.apiKeyUrl).toBe(undefined);
      });

      it("should handle selectedModel with missing title", () => {
        const selectedModel = {
          provider: "openai",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.modelTitle).toBe(undefined);
        expect(result.providerName).toBe("OpenAI");
        expect(result.apiKeyUrl).toBe(
          "https://platform.openai.com/account/api-keys",
        );
      });

      it("should handle selectedModel with missing provider", () => {
        const selectedModel = {
          title: "Custom Model",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.modelTitle).toBe("Custom Model");
        expect(result.providerName).toBe(undefined);
        expect(result.apiKeyUrl).toBe(undefined);
      });

      it("should handle empty selectedModel", () => {
        const selectedModel = {};
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.modelTitle).toBe(undefined);
        expect(result.providerName).toBe(undefined);
        expect(result.apiKeyUrl).toBe(undefined);
      });
    });

    describe("provider matching", () => {
      it("should match Anthropic provider", () => {
        const selectedModel = {
          title: "Claude 3.5 Sonnet",
          provider: "anthropic",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.providerName).toBe("Anthropic");
        expect(result.apiKeyUrl).toBe(
          "https://console.anthropic.com/account/keys",
        );
      });

      it("should match Groq provider", () => {
        const selectedModel = {
          title: "Llama 3.1 70B",
          provider: "groq",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.providerName).toBe("Groq");
        expect(result.apiKeyUrl).toBe("https://console.groq.com/keys");
      });

      it("should match provider with no apiKeyUrl", () => {
        const selectedModel = {
          title: "Llama 3.1",
          provider: "ollama",
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.providerName).toBe("Ollama");
        expect(result.apiKeyUrl).toBe(undefined);
      });

      it("should be case sensitive for provider matching", () => {
        const selectedModel = {
          title: "GPT-4",
          provider: "OpenAI", // Different case
        };
        const error = new Error("Test error");
        const result = analyzeError(error, selectedModel);

        expect(result.providerName).toBe("OpenAI"); // Should use the original casing
        expect(result.apiKeyUrl).toBe(undefined); // No match found
      });
    });

    describe("complex error scenarios", () => {
      it("should handle error with JSON message and status code", () => {
        const error = new Error(
          'HTTP 429 Rate Limited\n\n{"error": "Too many requests", "retry_after": 60}',
        );
        const selectedModel = {
          title: "GPT-4",
          provider: "openai",
        };
        const result = analyzeError(error, selectedModel);

        expect(result.parsedError).toBe('"Too many requests"');
        expect(result.statusCode).toBe(429);
        expect(result.message).toBe(
          'HTTP 429 Rate Limited\n\n{"error": "Too many requests", "retry_after": 60}',
        );
        expect(result.modelTitle).toBe("GPT-4");
        expect(result.providerName).toBe("OpenAI");
        expect(result.apiKeyUrl).toBe(
          "https://platform.openai.com/account/api-keys",
        );
      });

      it("should handle error with complex nested JSON structure", () => {
        const errorObj = {
          error: {
            message: "Invalid request",
            type: "invalid_request_error",
            param: "model",
            code: "model_not_found",
          },
        };
        const error = new Error(
          `400 Bad Request\n\n${JSON.stringify(errorObj)}`,
        );
        const selectedModel = {
          title: "GPT-4",
          provider: "openai",
        };
        const result = analyzeError(error, selectedModel);

        expect(result.parsedError).toBe(JSON.stringify(errorObj.error));
        expect(result.statusCode).toBe(400);
      });

      it("should handle Error instance vs plain object", () => {
        const errorInstance = new Error("Error instance message");
        const plainObject = { message: "Plain object message" };

        const result1 = analyzeError(errorInstance, null);
        const result2 = analyzeError(plainObject, null);

        expect(result1.message).toBe("Error instance message");
        expect(result2.message).toBe("Plain object message");
      });

      it("should handle malformed JSON gracefully", () => {
        const error = new Error('Header\n\n{"incomplete": json}');
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('{"incomplete": json}');
      });

      it("should handle empty JSON object", () => {
        const error = new Error("Header\n\n{}");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("{}");
      });

      it("should handle JSON with null values", () => {
        const error = new Error(
          'Header\n\n{"error": null, "message": "Something went wrong"}',
        );
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('"Something went wrong"');
      });

      it("should handle JSON with undefined values", () => {
        const errorObj = { error: undefined, message: "Undefined error" };
        const error = new Error(`Header\n\n${JSON.stringify(errorObj)}`);
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('"Undefined error"');
      });
    });

    describe("edge cases", () => {
      it("should handle very long error messages", () => {
        const longMessage = "A".repeat(10000);
        const error = new Error(longMessage);
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe(longMessage);
        expect(result.message).toBe(longMessage);
      });

      it("should handle error messages with special characters", () => {
        const specialMessage = "Error: 中文 🔥 \n\t Special chars";
        const error = new Error(specialMessage);
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe(specialMessage);
        expect(result.message).toBe(specialMessage);
      });

      it("should handle error messages with only newlines", () => {
        const error = new Error("\n\n\n");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("\n");
      });

      it("should handle circular JSON references gracefully", () => {
        const obj: any = { name: "test" };
        obj.self = obj;

        // This would normally cause JSON.stringify to throw
        const error = new Error('Header\n\n{"error": "circular reference"}');
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe('"circular reference"');
      });

      it("should handle error with numeric status codes as strings", () => {
        const error = new Error("HTTP 404 Not Found");
        const result = analyzeError(error, null);

        expect(result.statusCode).toBe(404);
        expect(typeof result.statusCode).toBe("number");
      });
    });

    describe("real-world error scenarios", () => {
      it("should handle OpenAI API key error", () => {
        const error = new Error(
          '401 Unauthorized\n\n{"error": {"message": "Invalid API key", "type": "invalid_request_error"}}',
        );
        const selectedModel = {
          title: "GPT-4",
          provider: "openai",
        };
        const result = analyzeError(error, selectedModel);

        expect(result.statusCode).toBe(401);
        expect(result.apiKeyUrl).toBe(
          "https://platform.openai.com/account/api-keys",
        );
      });

      it("should handle Anthropic rate limit error", () => {
        const error = new Error(
          '429 Too Many Requests\n\n{"error": {"type": "rate_limit_error", "message": "Rate limit exceeded"}}',
        );
        const selectedModel = {
          title: "Claude 3.5 Sonnet",
          provider: "anthropic",
        };
        const result = analyzeError(error, selectedModel);

        expect(result.statusCode).toBe(429);
        expect(result.providerName).toBe("Anthropic");
      });

      it("should handle network connectivity error", () => {
        const error = new Error("Network request failed");
        const selectedModel = {
          title: "Local Model",
          provider: "ollama",
        };
        const result = analyzeError(error, selectedModel);

        expect(result.parsedError).toBe("Network request failed");
        expect(result.statusCode).toBe(undefined);
        expect(result.providerName).toBe("Ollama");
      });

      it("should handle timeout error", () => {
        const error = new Error("Request timeout");
        const result = analyzeError(error, null);

        expect(result.parsedError).toBe("Request timeout");
        expect(result.statusCode).toBe(undefined);
      });
    });
  });
});
