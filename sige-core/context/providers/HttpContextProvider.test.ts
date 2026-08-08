/**
 * Tests for HttpContextProvider - specifically testing the fix for v1.0.19
 * where missing or null uri fields in server responses caused TypeErrors.
 *
 * The fix uses conditional access (item.uri &&) to safely handle null/undefined uri fields.
 */
import { ContextProviderExtras } from "../../index.js";
import HttpContextProvider from "./HttpContextProvider.js";

describe("HttpContextProvider", () => {
  let provider: HttpContextProvider;
  let mockExtras: ContextProviderExtras;

  beforeEach(() => {
    provider = new HttpContextProvider({
      title: "Test HTTP Provider",
      url: "http://localhost:3000/context",
    });

    mockExtras = {
      fullInput: "test input",
      fetch: jest.fn(),
      ide: {
        getCurrentFile: jest.fn().mockResolvedValue({ path: "/test/file.ts" }),
        getWorkspaceDirs: jest.fn().mockResolvedValue(["/test/"]),
      } as any,
      config: {} as any,
      embeddingsProvider: null,
      reranker: null,
      llm: {} as any,
      selectedCode: [],
      isInAgentMode: false,
    };
  });

  describe("getContextItems", () => {
    it("should handle response with valid uri field", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          description: "Test item",
          content: "Test content",
          name: "Test",
          uri: {
            type: "file",
            value: "/test/file.ts",
          },
        }),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test item",
        content: "Test content",
        name: "Test",
        uri: {
          type: "file",
          value: "/test/file.ts",
        },
      });
    });

    it("should handle response with null uri field", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          description: "Test item",
          content: "Test content",
          name: "Test",
          uri: null,
        }),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test item",
        content: "Test content",
        name: "Test",
        uri: null, // Should be null when uri is null (logical AND with null returns null)
      });
    });
    ``;

    it("should handle response with missing uri field", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          description: "Test item",
          content: "Test content",
          name: "Test",
          // uri field is completely missing
        }),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test item",
        content: "Test content",
        name: "Test",
        uri: undefined, // Should be undefined when uri is missing
      });
    });

    it("should handle array response with mixed uri fields", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue([
          {
            description: "Item with uri",
            content: "Content 1",
            name: "Item1",
            uri: {
              type: "file",
              value: "/test/file1.ts",
            },
          },
          {
            description: "Item without uri",
            content: "Content 2",
            name: "Item2",
            // uri field missing
          },
          {
            description: "Item with null uri",
            content: "Content 3",
            name: "Item3",
            uri: null,
          },
        ]),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(3);
      expect(result[0].uri).toEqual({ type: "file", value: "/test/file1.ts" });
      expect(result[1].uri).toBeUndefined();
      expect(result[2].uri).toBeNull(); // null uri becomes null
    });

    it("should use default values for missing fields", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          // All fields missing except uri
          uri: {
            type: "file",
            value: "/test/file.ts",
          },
        }),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "HTTP Context Item", // default value
        content: "", // default value
        name: "Test HTTP Provider", // from provider options
        uri: {
          type: "file",
          value: "/test/file.ts",
        },
      });
    });

    it("should handle partial uri objects gracefully", async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          description: "Test item",
          content: "Test content",
          name: "Test",
          uri: {
            type: "file",
            // missing value field - our fix should handle this gracefully
          },
        }),
      };

      (mockExtras.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test item",
        content: "Test content",
        name: "Test",
        uri: {
          type: "file",
          value: undefined, // value is undefined when missing
        },
      });
    });
  });
});
