import { DevDataLogEvent } from "@continuedev/config-yaml";
import fs from "fs";
import path from "path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { IdeInfo, IdeSettings } from "..";
import { Core } from "../core";
import { getDevDataFilePath } from "../util/paths";
import { DataLogger } from "./log";

// Only mock fetch, not fs
vi.mock("@continuedev/fetch");

const TEST_EVENT: DevDataLogEvent = {
  name: "tokensGenerated",
  data: {
    generatedTokens: 100,
    model: "gpt-4",
    promptTokens: 50,
    provider: "openai",
  },
};

const TEST_AGENT_INTERACTION_EVENT: DevDataLogEvent = {
  name: "chatInteraction",
  data: {
    prompt: "Hello, world!",
    completion: "Hello, world!",
    modelProvider: "openai",
    modelName: "gpt-4",
    modelTitle: "gpt-4",
    sessionId: "1234",
    tools: ["test-tool1"],
  },
};

const SCHEMA = "0.2.0";

describe("DataLogger", () => {
  let dataLogger: DataLogger;
  const tempDir = path.join(process.cwd(), "temp-test-data");
  const testFilePath = path.join(tempDir, "tokensGenerated-test.jsonl");

  // Create temp directory for test files
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  // Clean up temp directory after tests
  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Remove test file if it exists
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    // Get singleton instance
    dataLogger = DataLogger.getInstance();

    // Mock core and required promises
    dataLogger.core = {
      configHandler: {
        loadConfig: vi.fn().mockResolvedValue({
          config: {
            data: [],
          },
        }),
        currentProfile: {
          profileDescription: {
            id: "test-profile-id",
          },
        },
        controlPlaneClient: {
          getAccessToken: vi.fn().mockResolvedValue("test-access-token"),
        },
      },
    } as unknown as Core;

    dataLogger.ideSettingsPromise = Promise.resolve({
      userToken: "test-user-token",
    } as IdeSettings);

    dataLogger.ideInfoPromise = Promise.resolve({
      name: "VSCode",
      version: "1.0.0",
      extensionVersion: "0.1.0",
    } as IdeInfo);
  });

  describe("getInstance", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = DataLogger.getInstance();
      const instance2 = DataLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("addBaseValues", () => {
    it("should add base values to event data based on schema", async () => {
      const mockZodSchema = {
        shape: {
          eventName: true,
          timestamp: true,
          schema: true,
          userAgent: true,
          selectedProfileId: true,
          userId: true,
        },
      };

      const result = await dataLogger.addBaseValues(
        { customField: "value" },
        "testEvent",
        SCHEMA,
        mockZodSchema as any,
      );

      expect(result).toEqual({
        customField: "value",
        eventName: "testEvent",
        timestamp: expect.any(String),
        schema: SCHEMA,
        userAgent: "VSCode/1.0.0 (Continue/0.1.0)",
        selectedProfileId: "test-profile-id",
        userId: "test-user-token",
      });
    });

    it("should not add fields not present in schema shape", async () => {
      const mockZodSchema = {
        shape: {
          eventName: true,
          // No other fields
        },
      };

      const result = await dataLogger.addBaseValues(
        { customField: "value" },
        "testEvent",
        SCHEMA,
        mockZodSchema as any,
      );

      expect(result).toEqual({
        customField: "value",
        eventName: "testEvent",
      });
    });
  });

  describe("logLocalData", () => {
    it("should actually write data to the local file", async () => {
      // Call the method to log data locally
      await dataLogger.logLocalData(TEST_EVENT);

      // Verify the file was created
      const filepath = getDevDataFilePath(TEST_EVENT.name, SCHEMA);
      expect(fs.existsSync(filepath)).toBe(true);

      // Read file contents and verify
      const fileContent = fs.readFileSync(filepath, "utf8");
      expect(fileContent).toContain('"generatedTokens":100');
      expect(fileContent).toContain('"model":"gpt-4"');
      expect(fileContent).toContain('"eventName":"tokensGenerated"');
    });

    it("should write agent interaction data to local file", async () => {
      // Call the method to log data locally
      await dataLogger.logLocalData(TEST_AGENT_INTERACTION_EVENT);

      // Verify the file was created
      const filepath = getDevDataFilePath(
        TEST_AGENT_INTERACTION_EVENT.name,
        SCHEMA,
      );
      expect(fs.existsSync(filepath)).toBe(true);

      // Read file contents and verify
      const fileContent = fs.readFileSync(filepath, "utf8");
      expect(fileContent).toContain('"eventName":"chatInteraction"');
      expect(fileContent).toContain('"prompt":"Hello, world!"');
      expect(fileContent).toContain('"completion":"Hello, world!"');
      expect(fileContent).toContain('"tools":["test-tool1"]');
    });
  });

  describe("logDevData", () => {
    it("should log data locally and to configured destinations", async () => {
      // Spy on logLocalData and logToOneDestination
      const logLocalDataSpy = vi
        .spyOn(dataLogger, "logLocalData")
        .mockResolvedValue();
      const logToOneDestinationSpy = vi
        .spyOn(dataLogger, "logToOneDestination")
        .mockResolvedValue();

      // Mock config with multiple data destinations
      const mockConfig = {
        config: {
          data: [
            { destination: "https://example.com/logs", schema: SCHEMA },
            { destination: "file:///logs", schema: SCHEMA },
          ],
        },
      };

      dataLogger.core!.configHandler.loadConfig = vi
        .fn()
        .mockResolvedValue(mockConfig);

      await dataLogger.logDevData(TEST_EVENT);

      expect(logLocalDataSpy).toHaveBeenCalledWith(TEST_EVENT);
      expect(logToOneDestinationSpy).toHaveBeenCalledTimes(2);
    });
  });
});
