// core/util/GlobalContext.test.ts
import fs from "node:fs";
import path from "node:path";

import { GlobalContext } from "./GlobalContext";
import { getGlobalContextFilePath } from "./paths";
import { TEST_DIR } from "../test/testDir";

describe("GlobalContext", () => {
  const globalContextFilePath = path.join(TEST_DIR, "globalContext.json");

  beforeAll(() => {
    // Ensure the test directory exists
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    // Mock getGlobalContextFilePath to return the test path
    jest
      .spyOn(require("./paths"), "getGlobalContextFilePath")
      .mockReturnValue(globalContextFilePath);
  });

  afterEach(() => {
    // Clean up the test global context file after each test
    if (fs.existsSync(globalContextFilePath)) {
      fs.unlinkSync(globalContextFilePath);
    }
    jest.restoreAllMocks();
  });

  test("update writes data when file does not exist", () => {
    const globalContext = new GlobalContext();
    globalContext.update("indexingPaused", true);

    const data = fs.readFileSync(globalContextFilePath, "utf-8");
    const parsed = JSON.parse(data);
    expect(parsed).toEqual({ indexingPaused: true });
  });

  test("update updates data when file exists", () => {
    const globalContext = new GlobalContext();
    // First write initial data
    globalContext.update("indexingPaused", true);
    // Then update another property
    globalContext.update("selectedTabAutocompleteModel", "model-1");

    const data = fs.readFileSync(globalContextFilePath, "utf-8");
    const parsed = JSON.parse(data);
    expect(parsed).toEqual({
      indexingPaused: true,
      selectedTabAutocompleteModel: "model-1",
    });
  });

  test("get returns correct data when file exists", () => {
    const globalContext = new GlobalContext();
    // First write data
    globalContext.update("indexingPaused", true);
    globalContext.update("selectedTabAutocompleteModel", "model-1");

    const indexingPaused = globalContext.get("indexingPaused");
    const selectedModel = globalContext.get("selectedTabAutocompleteModel");

    expect(indexingPaused).toBe(true);
    expect(selectedModel).toBe("model-1");
  });

  test("get returns undefined when file does not exist", () => {
    const globalContext = new GlobalContext();

    const indexingPaused = globalContext.get("indexingPaused");
    expect(indexingPaused).toBeUndefined();
  });

  test("get returns undefined when key does not exist", () => {
    const globalContext = new GlobalContext();
    globalContext.update("indexingPaused", true);

    const nonExistentValue = globalContext.get("nonExistentKey" as any);

    expect(nonExistentValue).toBeUndefined();
  });

  test("update handles invalid JSON in existing file", () => {
    const globalContext = new GlobalContext();
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json");

    // Mock console.warn to capture warning messages
    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Attempt to update
    globalContext.update("indexingPaused", true);

    // Expect console.warn to have been called
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringMatching(/Error updating global context: .*/),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  test("get handles invalid JSON in existing file", () => {
    const globalContext = new GlobalContext();
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json");

    // Mock console.warn to capture warning messages
    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Attempt to get
    const value = globalContext.get("indexingPaused");

    // Expect value to be undefined
    expect(value).toBeUndefined();

    // Expect console.warn to have been called
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringMatching(/Error parsing global context: .*/),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  test("update handles existing file with non-JSON content", () => {
    const globalContext = new GlobalContext();
    // Write non-JSON content to the file
    fs.writeFileSync(globalContextFilePath, "Just some text");

    // Mock console.warn to capture warning messages
    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Attempt to update
    globalContext.update("indexingPaused", false);

    // Expect console.warn to have been called
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringMatching(/Error updating global context: .*/),
    );

    // Verify that the file now contains the updated key
    const data = fs.readFileSync(globalContextFilePath, "utf-8");
    const parsed = JSON.parse(data);
    expect(parsed).toEqual({ indexingPaused: false });

    // Clean up
    consoleWarnMock.mockRestore();
  });

  test("get handles existing file with non-JSON content", () => {
    const globalContext = new GlobalContext();
    // Write non-JSON content to the file
    fs.writeFileSync(globalContextFilePath, "Just some text");

    // Mock console.warn to capture warning messages
    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Attempt to get
    const value = globalContext.get("indexingPaused");

    // Expect value to be undefined
    expect(value).toBeUndefined();

    // Expect console.warn to have been called
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringMatching(/Error parsing global context: .*/),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  test("update writes complex data types", () => {
    const globalContext = new GlobalContext();
    const complexData = { workspace1: "profile1", workspace2: "profile2" };
    globalContext.update("lastSelectedProfileForWorkspace", complexData);

    const data = fs.readFileSync(globalContextFilePath, "utf-8");
    const parsed = JSON.parse(data);
    expect(parsed).toEqual({
      lastSelectedProfileForWorkspace: complexData,
    });
  });

  test("get retrieves complex data types", () => {
    const globalContext = new GlobalContext();
    const complexData = { workspace1: "profile1", workspace2: "profile2" };
    globalContext.update("lastSelectedProfileForWorkspace", complexData);

    const retrievedData = globalContext.get("lastSelectedProfileForWorkspace");
    expect(retrievedData).toEqual(complexData);
  });
});
